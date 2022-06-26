import * as core from '@actions/core'
import * as github from '@actions/github'
import * as logger from './logger'
import axios from 'axios'

import { Octokit } from '@octokit/action'
import {
  JobInfo,
  LineGraphOptions,
  StackedAreaGraphOptions,
  GraphResponse,
  ProcessedStats,
  CPUStats,
  MemoryStats,
  NetworkStats,
  DiskStats,
  ProcessedCPUStats,
  ProcessedMemoryStats,
  ProcessedNetworkStats,
  ProcessedDiskStats,
} from './interfaces'

const STAT_SERVER_PORT: number = 7777
const PAGE_SIZE: number = 100

const BLACK: string = '#000000'
const WHITE: string = '#FFFFFF'

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect()

    const { userLoadX, systemLoadX } = await getCPUStats()
    const { activeMemoryX, availableMemoryX } = await getMemoryStats()
    const { networkReadX, networkWriteX } = await getNetworkStats()
    const { diskReadX, diskWriteX } = await getDiskStats()

    const theme: string = core.getInput('theme', { required: false })
    let axisColor = BLACK
    switch (theme) {
      case 'light':
        axisColor = BLACK
        break
      case 'dark':
        axisColor = WHITE
        break
      default:
        core.warning(`Invalid theme: ${theme}`)
    }

    const cpuLoad =
        userLoadX && userLoadX.length && systemLoadX && systemLoadX.length
          ? (await getStackedAreaGraph({
              label: 'CPU Load (%)',
              axisColor,
              areas: [
                {
                  label: 'User Load',
                  color: '#e41a1c99',
                  points: userLoadX
                },
                {
                  label: 'System Load',
                  color: '#ff7f0099',
                  points: systemLoadX
                }
              ]
            }))
          : null

    const memoryUsage =
        activeMemoryX && activeMemoryX.length && availableMemoryX && availableMemoryX.length
          ? (await getStackedAreaGraph({
              label: 'Memory Usage (MB)',
              axisColor,
              areas: [
                {
                  label: 'Used',
                  color: '#377eb899',
                  points: activeMemoryX
                },
                {
                  label: 'Free',
                  color: '#4daf4a99',
                  points: availableMemoryX
                }
              ]
            }))
          : null

    const networkIORead =
        networkReadX && networkReadX.length
            ? (await getLineGraph({
                label: 'Network I/O Read (MB)',
                axisColor,
                line: {
                  label: 'Read',
                  color: '#be4d25',
                  points: networkReadX
                }
              }))
            : null

    const networkIOWrite =
        networkWriteX && networkWriteX.length
          ? (await getLineGraph({
              label: 'Network I/O Write (MB)',
              axisColor,
              line: {
                label: 'Write',
                color: '#6c25be',
                points: networkWriteX
              }
            }))
          : null

    const diskIORead =
        diskReadX && diskReadX.length
          ? (await getLineGraph({
              label: 'Disk I/O Read (MB)',
              axisColor,
              line: {
                label: 'Read',
                color: '#be4d25',
                points: diskReadX
              }
            }))
          : null

    const diskIOWrite =
        diskWriteX && diskWriteX.length
        ? (await getLineGraph({
            label: 'Disk I/O Write (MB)',
            axisColor,
            line: {
              label: 'Write',
              color: '#6c25be',
              points: diskWriteX
            }
          }))
        : null

    const octokit: Octokit = new Octokit()

    logger.debug(`Workflow - Job: ${workflow} - ${job}`)

    let commit: string = (pull_request && pull_request.head && pull_request.head.sha) || sha
    logger.debug(`Commit: ${commit}`)

    const jobInfo: JobInfo = await getJobInfo(octokit)
    logger.debug(`Job info: ${JSON.stringify(jobInfo)}`)

    let title = `## Workflow Telemetry - ${workflow}`
    if (jobInfo.name) {
      title = `${title} / ${jobInfo.name}`
    } else {
      title = `${title} / ${job}`
    }

    const commitUrl = `https://github.com/${repo.owner}/${repo.repo}/commit/${commit}`
    logger.debug(`Commit url: ${commitUrl}`)

    let info = `Workflow telemetry for commit [${commit}](${commitUrl})`
    if (jobInfo.id) {
      const jobUrl = `https://github.com/${repo.owner}/${repo.repo}/runs/${jobInfo.id}?check_suite_focus=true`
      logger.debug(`Job url: ${jobUrl}`)
      info = `${info}\nYou can access workflow job details [here](${jobUrl})`
    }

    const postContentItems: string[] = [
      title,
      '',
      info,
      '',
    ]
    if (cpuLoad) {
      postContentItems.push(
        '### CPU Metrics',
        `![${cpuLoad.id}](${cpuLoad.url})`,
        ''
      )
    }
    if (memoryUsage) {
      postContentItems.push(
        '### Memory Metrics',
        `![${memoryUsage.id}](${memoryUsage.url})`,
        ''
      )
    }
    if ((networkIORead && networkIOWrite) || (diskIORead && diskIOWrite)) {
      postContentItems.push(
        '### IO Metrics',
        '|               | Read      | Write     |',
        '|---            |---        |---        |'
      )
    }
    if (networkIORead && networkIOWrite) {
      postContentItems.push(
          `| Network I/O   | ![${networkIORead.id}](${networkIORead.url})        | ![${networkIOWrite.id}](${networkIOWrite.url})        |`
      )
    }
    if (diskIORead && diskIOWrite) {
      postContentItems.push(
          `| Disk I/O      | ![${diskIORead.id}](${diskIORead.url})              | ![${diskIOWrite.id}](${diskIOWrite.url})              |`
      )
    }
    const postContent: string = postContentItems.join('\n')

    const jobSummary: string = core.getInput('job_summary')
    if ('true' === jobSummary) {
      core.summary.addRaw(postContent)
      await core.summary.write()
    }

    const commentOnPR: string = core.getInput('comment_on_pr')
    if (pull_request && 'true' === commentOnPR) {
      logger.debug(`Found Pull Request: ${JSON.stringify(pull_request)}`)

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: postContent
      })
    } else {
      logger.debug(`Couldn't find Pull Request`)
    }

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

async function triggerStatCollect(): Promise<void> {
  logger.debug('Triggering stat collect ...')
  const response = await axios.post(
    `http://localhost:${STAT_SERVER_PORT}/collect`
  )
  logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
}

async function getCPUStats(): Promise<ProcessedCPUStats> {
  let userLoadX: ProcessedStats[] = []
  let systemLoadX: ProcessedStats[] = []

  logger.debug('Getting CPU stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/cpu`
  )
  logger.debug(`Got CPU stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: CPUStats) => {
    userLoadX.push({
      x: element.time,
      y: element.userLoad
    })

    systemLoadX.push({
      x: element.time,
      y: element.systemLoad
    })
  })

  return { userLoadX, systemLoadX }
}

async function getMemoryStats(): Promise<ProcessedMemoryStats> {
  let activeMemoryX: ProcessedStats[] = []
  let availableMemoryX: ProcessedStats[] = []

  logger.debug('Getting memory stats ...')
  const response = await axios.get(
      `http://localhost:${STAT_SERVER_PORT}/memory`
  )
  logger.debug(`Got memory stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: MemoryStats) => {
    activeMemoryX.push({
      x: element.time,
      y: element.activeMemoryMb
    })

    availableMemoryX.push({
      x: element.time,
      y: element.availableMemoryMb
    })
  })

  return { activeMemoryX, availableMemoryX }
}

async function getNetworkStats(): Promise<ProcessedNetworkStats> {
  let networkReadX: ProcessedStats[] = []
  let networkWriteX: ProcessedStats[] = []

  logger.debug('Getting network stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/network`
  )
  logger.debug(`Got network stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: NetworkStats) => {
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

async function getDiskStats(): Promise<ProcessedDiskStats> {
  let diskReadX: ProcessedStats[] = []
  let diskWriteX: ProcessedStats[] = []

  logger.debug('Getting disk stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/disk`)
  logger.debug(`Got disk stats: ${JSON.stringify(response.data)}`)

  response.data.forEach((element: DiskStats) => {
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

async function getLineGraph(options: LineGraphOptions): Promise<GraphResponse> {
  const payload = {
    options: {
      width: 1000,
      height: 500,
      xAxis: {
        label: 'Time',
        color: options.axisColor
      },
      yAxis: {
        label: options.label,
        color: options.axisColor
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

async function getStackedAreaGraph(options: StackedAreaGraphOptions): Promise<GraphResponse> {
  const payload = {
    options: {
      width: 1000,
      height: 500,
      xAxis: {
        label: 'Time',
        color: options.axisColor
      },
      yAxis: {
        label: options.label,
        color: options.axisColor
      },
      timeTicks: {
        unit: 'auto'
      }
    },
    areas: options.areas
  }

  const response = await axios.put(
      'https://api.globadge.com/v1/chartgen/stacked-area/time',
      payload
  )

  return response.data
}

async function getJobInfo(octokit: Octokit): Promise<JobInfo> {
  const _getJobInfo = async (): Promise<JobInfo> => {
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
      const currentJobs = jobs.filter(
        it =>
          it.status === 'in_progress' &&
          it.runner_name === process.env.RUNNER_NAME
      )
      if (currentJobs && currentJobs.length) {
        return {
          id: currentJobs[0].id,
          name: currentJobs[0].name
        }
      }
      // Since returning job count is less than page size, this means that there are no other jobs.
      // So no need to make another request for the next page.
      if (jobs.length < PAGE_SIZE) {
        break
      }
    }
    return {}
  }
  for (let i = 0; i < 10; i++) {
    const currentJobInfo = await _getJobInfo()
    if (currentJobInfo && currentJobInfo.id) {
      return currentJobInfo
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  return {}
}

run()
