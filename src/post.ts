import * as core from '@actions/core'
import * as github from '@actions/github'
import * as logger from './logger'
import axios from 'axios'

import { Octokit } from '@octokit/action'

const STAT_SERVER_PORT: number = 7777
const PAGE_SIZE: number = 100

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect()

    const { networkReadX, networkWriteX } = await getNetworkStats()
    const { diskReadX, diskWriteX } = await getDiskStats()

    const networkIORead = await getGraph({
      label: 'Network I/O Read (MB)',
      line: {
        label: 'Read',
        color: '#be4d25',
        points: networkReadX
      }
    })

    const networkIOWrite = await getGraph({
      label: 'Network I/O Write (MB)',
      line: {
        label: 'Write',
        color: '#6c25be',
        points: networkWriteX
      }
    })

    const diskIORead = await getGraph({
      label: 'Disk I/O Read (MB)',
      line: {
        label: 'Read',
        color: '#be4d25',
        points: diskReadX
      }
    })

    const diskIOWrite = await getGraph({
      label: 'Disk I/O Write (MB)',
      line: {
        label: 'Write',
        color: '#6c25be',
        points: diskWriteX
      }
    })

    if (pull_request) {
      logger.info(`Found Pull Request: ${JSON.stringify(pull_request)}`)
      const octokit: Octokit = new Octokit()

      logger.debug(`Workflow - job: ${workflow} - ${job}`)

      logger.debug(`Commit: ${sha}`)

      const jobId: number = await getJobId(octokit)
      logger.debug(`Job id: ${jobId}`)

      const jobUrl = `https://github.com/${repo.owner}/${repo.repo}/runs/${jobId}?check_suite_focus=true`
      logger.debug(`Job url: ${jobUrl}`)

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: [
          '## Workflow Telemetry',
          '',
          '|               | Read      | Write     |',
          '|---            |---        |---        |',
          `| Network I/O   | ![${networkIORead.id}](${networkIORead.url})        | ![${networkIOWrite.id}](${networkIOWrite.url})        |`,
          `| Disk I/O      | ![${diskIORead.id}](${diskIORead.url})              | ![${diskIOWrite.id}](${diskIOWrite.url})              |`
        ].join('\n')
      })
    } else {
      logger.info(`Couldn't find Pull Request`)
    }

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

async function triggerStatCollect(): Promise<any> {
  logger.debug('Triggering stat collect ...')
  const response = await axios.post(`http://localhost:${STAT_SERVER_PORT}/collect`)
  logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
}

async function getNetworkStats(): Promise<any> {
  let networkReadX: any[] = []
  let networkWriteX: any[] = []

  logger.debug('Getting network stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/network`)
  logger.debug(`Got network stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: any) => {
    networkReadX.push({
      x: element.time,
      y: element.rxMb
    })

    networkWriteX.push({
      x: element.time,
      y: element.txMb
    })
  })

  return { networkReadX, networkWriteX }
}

async function getDiskStats(): Promise<any> {
  let diskReadX: any[] = []
  let diskWriteX: any[] = []

  logger.debug('Getting disk stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/disk`)
  logger.debug(`Got disk stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: any) => {
    diskReadX.push({
      x: element.time,
      y: element.rxMb
    })

    diskWriteX.push({
      x: element.time,
      y: element.wxMb
    })
  })

  return { diskReadX, diskWriteX }
}

async function getGraph(options: any): Promise<any> {
  const payload = {
    options: {
      width: 1000,
      height: 500,
      xAxis: {
        label: 'Time'
      },
      yAxis: {
        label: options.label
      },
      timeTicks: {
        unit: 'auto'
      }
    },
    lines: [options.line]
  }

  const response = await axios.put(
    'https://api.globadge.com/v1/chartgen/line/time',
    payload
  )

  return response.data
}

async function getJobId(octokit: Octokit): Promise<number>  {
  const getJobId = async() => {
    for (let page = 0; true; page++) {
      const result = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: repo.owner,
        repo: repo.repo,
        run_id: runId,
        per_page: PAGE_SIZE,
        page
      })
      const jobs = result.data.jobs
      // If there are no jobs, stop here
      if (!jobs || !jobs.length) {
        break
      }
      const currentJobs = jobs
          .filter(it => it.status === 'in_progress' && it.runner_name === process.env.RUNNER_NAME)
      if (currentJobs && currentJobs.length) {
        return currentJobs[0].id
      }
      // Since returning job count is less than page size, this means that there are no other jobs.
      // So no need to make another request for the next page.
      if (jobs.length < PAGE_SIZE) {
        break
      }
    }
    return null
  }
  for (let i = 0; i < 10; i++) {
    const currentJobId = await getJobId()
    if (currentJobId) {
      return currentJobId
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return -1
}

run()
