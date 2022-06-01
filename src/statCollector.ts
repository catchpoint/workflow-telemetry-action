import si from 'systeminformation'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'
import * as logger from './logger'

const STATS_FREQ: number = parseInt(process.env.FORESIGHT_WORKFLOW_TELEMETRY_STAT_FREQ || '') || 5000
const HOST: string = 'localhost'
// TODO
// It is better to find an available port and use it.
// The post script (post.ts) needs to know the selected port
const PORT: number = 7777

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

function collectNetworkStats(statTime: number, timeInterval: number) {
  si.networkStats()
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

interface DiskStats {
  readonly time: number
  readonly rxMb: number
  readonly wxMb: number
}

function collectDiskStats(statTime: number, timeInterval: number) {
  si.fsStats()
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

function collectStats() {
  try {
    if (!statCollectTime) {
      const currentTime: number = Date.now()
      const timeSec: number = currentTime - (currentTime % 1000)
      statCollectTime = timeSec
    } else {
      statCollectTime += STATS_FREQ
    }
    collectNetworkStats(statCollectTime, STATS_FREQ)
    collectDiskStats(statCollectTime, STATS_FREQ)
  } finally {
    expectedScheduleTime += STATS_FREQ
    setTimeout(collectStats, expectedScheduleTime - Date.now())
  }
}

function startHttpServer() {
  const server: Server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
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
        default: {
          response.statusCode = 404
          response.end()
        }
      }
    }
  )

  server.listen(PORT, HOST, () => {
    logger.info(`Stat server listening on port ${PORT}`)
  })
}

function init() {
  expectedScheduleTime = Date.now() + STATS_FREQ;

  logger.info('Starting stat collector ...')
  setTimeout(collectStats, STATS_FREQ);

  logger.info('Starting HTTP server ...')
  startHttpServer()
}

const currentTime = Date.now()
const nextSec = currentTime + 1000 - (currentTime % 1000)
setTimeout(init, nextSec - currentTime - 1)
