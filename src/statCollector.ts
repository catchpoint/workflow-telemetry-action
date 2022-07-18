import { ChildProcess, spawn } from 'child_process'
import path from 'path'
import axios from 'axios'
import * as core from '@actions/core'
import {
  CPUStats,
  DiskStats,
  GraphResponse,
  LineGraphOptions,
  MemoryStats,
  NetworkStats,
  ProcessedCPUStats,
  ProcessedDiskStats,
  ProcessedMemoryStats,
  ProcessedNetworkStats,
  ProcessedStats,
  StackedAreaGraphOptions,
  WorkflowJobType
} from './interfaces'
import * as logger from './logger'

const STAT_SERVER_PORT = 7777

const BLACK = '#000000'
const WHITE = '#FFFFFF'

async function triggerStatCollect(): Promise<void> {
  logger.debug('Triggering stat collect ...')
  const response = await axios.post(
    `http://localhost:${STAT_SERVER_PORT}/collect`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Triggered stat collect: ${JSON.stringify(response.data)}`)
  }
}

async function reportWorkflowMetrics(): Promise<string> {
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

  const { userLoadX, systemLoadX } = await getCPUStats()
  const { activeMemoryX, availableMemoryX } = await getMemoryStats()
  const { networkReadX, networkWriteX } = await getNetworkStats()
  const { diskReadX, diskWriteX } = await getDiskStats()

  const cpuLoad =
    userLoadX && userLoadX.length && systemLoadX && systemLoadX.length
      ? await getStackedAreaGraph({
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
        })
      : null

  const memoryUsage =
    activeMemoryX &&
    activeMemoryX.length &&
    availableMemoryX &&
    availableMemoryX.length
      ? await getStackedAreaGraph({
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
        })
      : null

  const networkIORead =
    networkReadX && networkReadX.length
      ? await getLineGraph({
          label: 'Network I/O Read (MB)',
          axisColor,
          line: {
            label: 'Read',
            color: '#be4d25',
            points: networkReadX
          }
        })
      : null

  const networkIOWrite =
    networkWriteX && networkWriteX.length
      ? await getLineGraph({
          label: 'Network I/O Write (MB)',
          axisColor,
          line: {
            label: 'Write',
            color: '#6c25be',
            points: networkWriteX
          }
        })
      : null

  const diskIORead =
    diskReadX && diskReadX.length
      ? await getLineGraph({
          label: 'Disk I/O Read (MB)',
          axisColor,
          line: {
            label: 'Read',
            color: '#be4d25',
            points: diskReadX
          }
        })
      : null

  const diskIOWrite =
    diskWriteX && diskWriteX.length
      ? await getLineGraph({
          label: 'Disk I/O Write (MB)',
          axisColor,
          line: {
            label: 'Write',
            color: '#6c25be',
            points: diskWriteX
          }
        })
      : null

  const postContentItems: string[] = []
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

  return postContentItems.join('\n')
}

async function getCPUStats(): Promise<ProcessedCPUStats> {
  const userLoadX: ProcessedStats[] = []
  const systemLoadX: ProcessedStats[] = []

  logger.debug('Getting CPU stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/cpu`)
  if (logger.isDebugEnabled()) {
    logger.debug(`Got CPU stats: ${JSON.stringify(response.data)}`)
  }

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
  const activeMemoryX: ProcessedStats[] = []
  const availableMemoryX: ProcessedStats[] = []

  logger.debug('Getting memory stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/memory`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Got memory stats: ${JSON.stringify(response.data)}`)
  }

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
  const networkReadX: ProcessedStats[] = []
  const networkWriteX: ProcessedStats[] = []

  logger.debug('Getting network stats ...')
  const response = await axios.get(
    `http://localhost:${STAT_SERVER_PORT}/network`
  )
  if (logger.isDebugEnabled()) {
    logger.debug(`Got network stats: ${JSON.stringify(response.data)}`)
  }

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
  const diskReadX: ProcessedStats[] = []
  const diskWriteX: ProcessedStats[] = []

  logger.debug('Getting disk stats ...')
  const response = await axios.get(`http://localhost:${STAT_SERVER_PORT}/disk`)
  if (logger.isDebugEnabled()) {
    logger.debug(`Got disk stats: ${JSON.stringify(response.data)}`)
  }

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

async function getStackedAreaGraph(
  options: StackedAreaGraphOptions
): Promise<GraphResponse> {
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

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting stat collector ...`)

  try {
    let statFrequency = 0
    const statFrequencyInput: string = core.getInput('stat_frequency')
    if (statFrequencyInput) {
      const statFrequencyVal: number = parseInt(statFrequencyInput)
      if (Number.isInteger(statFrequencyVal)) {
        statFrequency = statFrequencyVal * 1000
      }
    }

    const child: ChildProcess = spawn(
      process.argv[0],
      [path.join(__dirname, '../scw/index.js')],
      {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          WORKFLOW_TELEMETRY_STAT_FREQ: statFrequency
            ? `${statFrequency}`
            : undefined
        }
      }
    )
    child.unref()

    logger.info(`Started stat collector`)

    return true
  } catch (error: any) {
    logger.error('Unable to start stat collector')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing stat collector ...`)

  try {
    // Trigger stat collect, so we will have remaining stats since the latest schedule
    await triggerStatCollect()

    logger.info(`Finished stat collector`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish stat collector')
    logger.error(error)

    return false
  }
}

export async function report(
  currentJob: WorkflowJobType
): Promise<string | null> {
  logger.info(`Reporting stat collector result ...`)

  try {
    const postContent: string = await reportWorkflowMetrics()

    logger.info(`Reported stat collector result`)

    return postContent
  } catch (error: any) {
    logger.error('Unable to report stat collector result')
    logger.error(error)

    return null
  }
}
