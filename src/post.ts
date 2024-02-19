import * as core from '@actions/core'
import * as github from '@actions/github'
import { Octokit } from '@octokit/action'
import * as stepTracer from './stepTracer'
import * as statCollector from './statCollector'
import * as processTracer from './processTracer'
import * as logger from './logger'
import { WorkflowJobType } from './interfaces'

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context
const PAGE_SIZE = 100
const octokit: Octokit = new Octokit()

async function getCurrentJob(): Promise<WorkflowJobType | null> {
  const _getCurrentJob = async (): Promise<WorkflowJobType | null> => {
    for (let page = 0; ; page++) {
      const result = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: repo.owner,
        repo: repo.repo,
        run_id: runId,
        per_page: PAGE_SIZE,
        page
      })
      const jobs: WorkflowJobType[] = result.data.jobs
      // If there are no jobs, stop here
      if (!jobs || !jobs.length) {
        break
      }
      const currentJobs = jobs.filter(
        it =>
          it.status === 'in_progress' &&
          it.runner_name === process.env.RUNNER_NAME
      )
      if (currentJobs && currentJobs.length) {
        return currentJobs[0]
      }
      // Since returning job count is less than page size, this means that there are no other jobs.
      // So no need to make another request for the next page.
      if (jobs.length < PAGE_SIZE) {
        break
      }
    }
    return null
  }
  try {
    for (let i = 0; i < 10; i++) {
      const currentJob: WorkflowJobType | null = await _getCurrentJob()
      if (currentJob && currentJob.id) {
        return currentJob
      }
      await new Promise(r => setTimeout(r, 1000))
    }
  } catch (error: any) {
    logger.error(
      `Unable to get current workflow job info. ` +
        `Please sure that your workflow have "actions:read" permission!`
    )
  }
  return null
}

async function reportAll(
  currentJob: WorkflowJobType,
  content: string
): Promise<void> {
  logger.info(`Reporting all content ...`)

  logger.debug(`Workflow - Job: ${workflow} - ${job}`)

  const jobUrl = `https://github.com/${repo.owner}/${repo.repo}/runs/${currentJob.id}?check_suite_focus=true`
  logger.debug(`Job url: ${jobUrl}`)

  const title = `## Workflow Telemetry - ${workflow} / ${currentJob.name}`
  logger.debug(`Title: ${title}`)

  const commit: string =
    (pull_request && pull_request.head && pull_request.head.sha) || sha
  logger.debug(`Commit: ${commit}`)

  const commitUrl = `https://github.com/${repo.owner}/${repo.repo}/commit/${commit}`
  logger.debug(`Commit url: ${commitUrl}`)

  const info =
    `Workflow telemetry for commit [${commit}](${commitUrl})\n` +
    `You can access workflow job details [here](${jobUrl})`

  const postContent: string = [title, info, content].join('\n')

  const jobSummary: string = core.getInput('job_summary')
  if ('true' === jobSummary) {
    core.summary.addRaw(postContent)
    await core.summary.write()
  }

  const commentOnPR: string = core.getInput('comment_on_pr')
  if (pull_request && ['true', 'update'].indexOf(commentOnPR) >= 0) {
    if (logger.isDebugEnabled()) {
      logger.debug(`Found Pull Request: ${JSON.stringify(pull_request)}`)
    }

    const issueNumber = Number(github.context.payload.pull_request?.number);
    let createComment: boolean = true
    if ('update' === commentOnPR) {
      let existingComment, comments, page = 1;
      do {
        comments = await octokit.rest.issues.listComments({
          ...github.context.repo,
          issue_number: issueNumber,
          page,
        })
        existingComment = comments.data.find(comment => comment.body.startsWith(title))
        page++
      } while (!existingComment && comments.data.length > 0);

      if (existingComment) {
        if (logger.isDebugEnabled()) {
          logger.debug(`Found Comment: ${existingComment.id}`)
        }
        createComment = false
        await octokit.rest.issues.updateComment({
          ...github.context.repo,
          comment_id: existingComment.id,
          body: postContent,
        })
      }
    }

    if (createComment) {
      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: issueNumber,
        body: postContent
      })
    }
  } else {
    logger.debug(`Couldn't find Pull Request`)
  }

  logger.info(`Reporting all content completed`)
}

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    const currentJob: WorkflowJobType | null = await getCurrentJob()

    if (!currentJob) {
      logger.error(
        `Couldn't find current job. So action will not report any data.`
      )
      return
    }

    logger.debug(`Current job: ${JSON.stringify(currentJob)}`)

    // Finish step tracer
    await stepTracer.finish(currentJob)
    // Finish stat collector
    await statCollector.finish(currentJob)
    // Finish process tracer
    await processTracer.finish(currentJob)

    // Report step tracer
    const stepTracerContent: string | null = await stepTracer.report(currentJob)
    // Report stat collector
    const stepCollectorContent: string | null =
      await statCollector.report(currentJob)
    // Report process tracer
    const procTracerContent: string | null =
      await processTracer.report(currentJob)

    let allContent = ''

    if (stepTracerContent) {
      allContent = allContent.concat(stepTracerContent, '\n')
    }
    if (stepCollectorContent) {
      allContent = allContent.concat(stepCollectorContent, '\n')
    }
    if (procTracerContent) {
      allContent = allContent.concat(procTracerContent, '\n')
    }

    await reportAll(currentJob, allContent)

    logger.info(`Finish completed`)
  } catch (error: any) {
    logger.error(error.message)
  }
}

run()
