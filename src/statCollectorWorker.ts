import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import si from 'systeminformation'
import * as logger from './logger'
import {
  CPUStats,
  MemoryStats,
  DiskStats,
  NetworkStats,
} from './interfaces'
import { SERVER_PORT, setServerPort } from './utils'

const STATS_FREQ: number =
  parseInt(process.env.WORKFLOW_TELEMETRY_STAT_FREQ || '') || 5000
const SERVER_HOST: string = 'localhost'
// TODO
// It is better to find an available/free port automatically and use it.
// Then the post script (`post.ts`) needs to know the selected port.

let expectedScheduleTime: number = 0
let statCollectTime: number = 0

///////////////////////////

// CPU Stats             //
///////////////////////////

const cpuStatsHistogram: CPUStats[] = []

function collectCPUStats(
    statTime: number,
    timeInterval: number
): Promise<any> {
  return si
      .currentLoad()
      .then((data: si.Systeminformation.CurrentLoadData) => {
        const cpuStats: CPUStats = {
          time: statTime,
          totalLoad: data.currentLoad,
          userLoad: data.currentLoadUser,
          systemLoad: data.currentLoadSystem
        }
        cpuStatsHistogram.push(cpuStats)
      })
      .catch((error: any) => {
        logger.error(error)
      })
}

///////////////////////////

// Memory Stats          //
///////////////////////////

const memoryStatsHistogram: MemoryStats[] = []

function collectMemoryStats(
    statTime: number,
    timeInterval: number
): Promise<any> {
  return si
      .mem()
      .then((data: si.Systeminformation.MemData) => {
        const memoryStats: MemoryStats = {
          time: statTime,
          totalMemoryMb: data.total / 1024 / 1024,
          activeMemoryMb: data.active / 1024 / 1024,
          availableMemoryMb: data.available / 1024 / 1024
        }
        memoryStatsHistogram.push(memoryStats)
      })
      .catch((error: any) => {
        logger.error(error)
      })
}

///////////////////////////

// Network Stats         //
///////////////////////////

const networkStatsHistogram: NetworkStats[] = []

function collectNetworkStats(
  statTime: number,
  timeInterval: number
): Promise<any> {
  return si
    .networkStats()
    .then((data: si.Systeminformation.NetworkStatsData[]) => {
      let totalRxSec = 0,
        totalTxSec = 0
      for (let nsd of data) {
        totalRxSec += nsd.rx_sec
        totalTxSec += nsd.tx_sec
      }
      const networkStats: NetworkStats = {
        time: statTime,
        rxMb: Math.floor((totalRxSec * (timeInterval / 1000)) / 1024 / 1024),
        txMb: Math.floor((totalTxSec * (timeInterval / 1000)) / 1024 / 1024)
      }
      networkStatsHistogram.push(networkStats)
    })
    .catch((error: any) => {
      logger.error(error)
    })
}

///////////////////////////

// Disk Stats            //
///////////////////////////

const diskStatsHistogram: DiskStats[] = []

function collectDiskStats(
  statTime: number,
  timeInterval: number
): Promise<any> {
  return si
    .fsStats()
    .then((data: si.Systeminformation.FsStatsData) => {
      let rxSec = data.rx_sec ? data.rx_sec : 0
      let wxSec = data.wx_sec ? data.wx_sec : 0
      const diskStats: DiskStats = {
        time: statTime,
        rxMb: Math.floor((rxSec * (timeInterval / 1000)) / 1024 / 1024),
        wxMb: Math.floor((wxSec * (timeInterval / 1000)) / 1024 / 1024)
      }
      diskStatsHistogram.push(diskStats)
    })
    .catch((error: any) => {
      logger.error(error)
    })
}

///////////////////////////

async function collectStats(triggeredFromScheduler: boolean = true) {
  try {
    const currentTime: number = Date.now()
    const timeInterval: number = statCollectTime
      ? currentTime - statCollectTime
      : 0

    statCollectTime = currentTime

    const promises: Promise<any>[] = []

    promises.push(collectCPUStats(statCollectTime, timeInterval))
    promises.push(collectMemoryStats(statCollectTime, timeInterval))
    promises.push(collectNetworkStats(statCollectTime, timeInterval))
    promises.push(collectDiskStats(statCollectTime, timeInterval))

    return promises
  } finally {
    if (triggeredFromScheduler) {
      expectedScheduleTime += STATS_FREQ
      setTimeout(collectStats, expectedScheduleTime - Date.now())
    }
  }
}

function startHttpServer() {
  const server: Server = createServer(
    async (request: IncomingMessage, response: ServerResponse) => {
      try {
        switch (request.url) {
          case '/cpu': {
            if (request.method === 'GET') {
              response.end(JSON.stringify(cpuStatsHistogram))
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          case '/memory': {
            if (request.method === 'GET') {
              response.end(JSON.stringify(memoryStatsHistogram))
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          case '/network': {
            if (request.method === 'GET') {
              response.end(JSON.stringify(networkStatsHistogram))
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          case '/disk': {
            if (request.method === 'GET') {
              response.end(JSON.stringify(diskStatsHistogram))
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          case '/collect': {
            if (request.method === 'POST') {
              await collectStats(false)
              response.end()
            } else {
              response.statusCode = 405
              response.end()
            }
            break
          }
          default: {
            response.statusCode = 404
            response.end()
          }
        }
      } catch (error: any) {
        logger.error(error)
        response.statusCode = 500
        response.end(
          JSON.stringify({
            type: error.type,
            message: error.message
          })
        )
      }
    }
  )

  server.listen(SERVER_PORT, SERVER_HOST, () => {
    logger.info(`Stat server listening on port ${SERVER_PORT}`)
  })
}

// Init                  //
///////////////////////////

function init() {
  setServerPort();
  expectedScheduleTime = Date.now()

  logger.info('Starting stat collector ...')
  process.nextTick(collectStats)

  logger.info('Starting HTTP server ...')
  startHttpServer()
}

init();

///////////////////////////
