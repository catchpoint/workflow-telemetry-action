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
  DiskStats,
  ProcessedDiskStats,
  NetworkStats,
  ProcessedNetworkStats, ProcessedCPUStats, CPUStats
} from './interfaces'

const STAT_SERVER_PORT: number = 7777
const PAGE_SIZE: number = 100

const { pull_request } = github.context.payload
const { workflow, job, repo, runId, sha } = github.context

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect()

    const { userLoadX, systemLoadX } = await getCPUStats()
    const { networkReadX, networkWriteX } = await getNetworkStats()
    const { diskReadX, diskWriteX } = await getDiskStats()

    const cpuLoad = await getStackedAreaGraph({
      label: 'CPU Load (%)',
      areas: [
        {
          label: 'User Load',
          color: '#e41a1c',
          points: userLoadX
        },
        {
          label: 'System Load',
          color: '#ff7f00',
          points: systemLoadX
        }
      ]
    })

    const networkIORead = await getLineGraph({
      label: 'Network I/O Read (MB)',
      line: {
        label: 'Read',
        color: '#be4d25',
        points: networkReadX
      }
    })

    const networkIOWrite = await getLineGraph({
      label: 'Network I/O Write (MB)',
      line: {
        label: 'Write',
        color: '#6c25be',
        points: networkWriteX
      }
    })

    const diskIORead = await getLineGraph({
      label: 'Disk I/O Read (MB)',
      line: {
        label: 'Read',
        color: '#be4d25',
        points: diskReadX
      }
    })

    const diskIOWrite = await getLineGraph({
      label: 'Disk I/O Write (MB)',
      line: {
        label: 'Write',
        color: '#6c25be',
        points: diskWriteX
      }
    })

    if (pull_request) {
      logger.debug(`Found Pull Request: ${JSON.stringify(pull_request)}`)

      const octokit: Octokit = new Octokit()

      logger.debug(`Workflow - Job: ${workflow} - ${job}`)

      const commit: string = (pull_request.head && pull_request.head.sha) || sha
      logger.debug(`Commit: ${commit}`)

      const jobInfo: JobInfo = await getJobInfo(octokit)
      logger.debug(`Job info: ${JSON.stringify(jobInfo)}`)

      let title = `## Workflow Telemetry - ${workflow}`
      if (jobInfo.name) {
        title = `${title} / ${jobInfo.name}`
      } else {
        title = `${title} / ${job}`
      }

      let info = `Workflow telemetry for commit ${commit}`
      if (jobInfo.id) {
        const jobUrl = `https://github.com/${repo.owner}/${repo.repo}/runs/${jobInfo.id}?check_suite_focus=true`
        logger.debug(`Job url: ${jobUrl}`)
        info = `${info}\nYou can access workflow job details [here](${jobUrl})`
      }

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: [
          title,
          '',
          info,
          '',
          '### CPU Metrics',
          `![${cpuLoad.id}](${cpuLoad.url})`,
          '',
          '### IO Metrics',
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

async function getStackedAreaGraph(options: StackedAreaGraphOptions): Promise<GraphResponse> {
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
