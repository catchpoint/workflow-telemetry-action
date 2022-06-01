import si from 'systeminformation'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import * as logger from './logger'

const STATS_FREQ: number =
  parseInt(process.env.WORKFLOW_TELEMETRY_STAT_FREQ || '') || 5000
const SERVER_HOST: string = 'localhost'
// TODO
// It is better to find an available/free port automatically and use it.
// Then the post script (`post.ts`) needs to know the selected port.
const SERVER_PORT: number =
  parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '') || 7777

let expectedScheduleTime: number = 0
let statCollectTime: number = 0

// Network Stats         //
///////////////////////////

interface NetworkStats {
  readonly time: number
  readonly rxMb: number
  readonly txMb: number
}

const networkStatsHistogram: NetworkStats[] = []

function collectNetworkStats(statTime: number, timeInterval: number): Promise<any> {
  return si.networkStats()
    .then((data: si.Systeminformation.NetworkStatsData[]) => {
      let totalRxSec = 0, totalTxSec = 0
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

interface DiskStats {
  readonly time: number
  readonly rxMb: number
  readonly wxMb: number
}

function collectDiskStats(statTime: number, timeInterval: number): Promise<any> {
  return si.fsStats()
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
    const timeInterval: number = statCollectTime ? (currentTime - statCollectTime) : 0

    statCollectTime = currentTime

    const promises: Promise<any>[] = []

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
    async(request: IncomingMessage, response: ServerResponse) => {
      try {
        switch (request.url) {
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
        response.end(JSON.stringify({
          type: error.type,
          message: error.message,
        }))
      }
    }
  )

  server.listen(SERVER_PORT, SERVER_HOST, () => {
    logger.info(`Stat server listening on port ${SERVER_PORT}`)
  })
}

function init() {
  expectedScheduleTime = Date.now()

  logger.info('Starting stat collector ...')
  process.nextTick(collectStats)

  logger.info('Starting HTTP server ...')
  startHttpServer()
}

init()
