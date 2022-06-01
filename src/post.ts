import * as core from '@actions/core'
import * as github from '@actions/github'
import * as logger from './logger'
import axios, { AxiosResponse } from 'axios'

import { Octokit } from '@octokit/action'

const { pull_request } = github.context.payload

async function run(): Promise<void> {
  try {
    logger.info(`[WM] Finishing ...`)

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

    const octokit = new Octokit()
    if (pull_request) {
      logger.info(`[WM] Found Pull Request: ${pull_request}`)

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: [
          '|               | Read      | Write     |',
          '|---            |---        |---        |',
          `| Network I/O   | ![${networkIORead.id}](${networkIORead.url})        | ![${networkIOWrite.id}](${networkIOWrite.url})        |`,
          `| Disk I/O      | ![${diskIORead.id}](${diskIORead.url})              | ![${diskIOWrite.id}](${diskIOWrite.url})              |`
        ].join('\n')
      })
    } else {
      logger.info(`[WM] Couldn't Find Pull Request`)
    }

    logger.info(`[WM] Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

async function getNetworkStats(): Promise<any> {
  let networkReadX: any[] = []
  let networkWriteX: any[] = []

  logger.info('[WM] Get network stats!')
  const response = await axios.get('http://localhost:7777/network')
  logger.info(`[WM] Got Network Data: ${JSON.stringify(response.data)}`)

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

  logger.info('[WM] Get disk stats!')
  const response = await axios.get('http://localhost:7777/disk')
  logger.info(`[WM] Got Disk Data: ${JSON.stringify(response.data)}`)

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

run()
