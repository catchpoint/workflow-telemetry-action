import * as core from '@actions/core'
import * as github from '@actions/github'
import * as logger from './logger'
import axios from 'axios'

import { Octokit } from '@octokit/action'

const { pull_request } = github.context.payload

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    const octokit: Octokit = new Octokit()

    const jobId: number = await getJobId(octokit)
    logger.info(`Job id: ${jobId}`)

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
      logger.info(`Found Pull Request: ${pull_request}`)

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: [
          '## Foresight - Workflow Telemetry',
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
  const response = await axios.post('http://localhost:7777/collect')
  logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
}

async function getNetworkStats(): Promise<any> {
  let networkReadX: any[] = []
  let networkWriteX: any[] = []

  logger.debug('Getting network stats ...')
  const response = await axios.get('http://localhost:7777/network')
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
  const response = await axios.get('http://localhost:7777/disk')
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
    const result = await octokit.rest.actions.listJobsForWorkflowRun({
      owner: process.env.GITHUB_REPOSITORY_OWNER as string,
      repo: (process.env.GITHUB_REPOSITORY as string).split('/')[1],
      run_id: parseInt(process.env.GITHUB_RUN_ID as string, 10),
      per_page: 100
    });
    const currentJobs = result.data.jobs
            .filter(it => it.status === 'in_progress' && it.runner_name === process.env.RUNNER_NAME)
    if (currentJobs && currentJobs.length) {
      return currentJobs[0].id
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
