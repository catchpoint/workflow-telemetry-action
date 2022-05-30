import si from 'systeminformation'
import { createServer, IncomingMessage, Server, ServerResponse } from 'http'

const STATS_FREQ: number = 5000
let statCollectTime: number = 0

// Network Stats         //
///////////////////////////

interface NetworkStats {
  readonly time: number
  readonly rxKb: number
  readonly txKb: number
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
        rxKb: Math.floor((totalRxSec * (timeInterval / 1000)) / 1024),
        txKb: Math.floor((totalTxSec * (timeInterval / 1000)) / 1024)
      }
      networkStatsHistogram.push(networkStats)
    })
    .catch((error: any) => {
      console.error(error)
    })
}

///////////////////////////

function collectStats() {
  if (!statCollectTime) {
    const currentTime: number = Date.now()
    const timeSec: number = currentTime - (currentTime % 1000)
    statCollectTime = timeSec
  } else {
    statCollectTime += STATS_FREQ
  }
  collectNetworkStats(statCollectTime, STATS_FREQ)
}

console.log('[WM] Starting stat collector ...')

setInterval(collectStats, STATS_FREQ)

function startHttpServer() {
  const HOST: string = 'localhost'
  const PORT: number = 7777

  const server: Server = createServer(
    (request: IncomingMessage, response: ServerResponse) => {
      switch (request.url) {
        case '/network': {
          console.log('[WM] Received network request')
          if (request.method === 'GET') {
            console.log('[WM] Received network get request')
            response.end(JSON.stringify(networkStatsHistogram))
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
    console.log(`[WM] Stat server listening on port ${PORT}`)
  })
}

console.log('[WM] Starting HTTP server ...')

startHttpServer()

/*
setInterval(() => {
    core.info('>>>>> Dumping network stats ...')
    for (let [time, stats] of networkStatsHistogram.entries()) {
        const timeStr: string = new Date(time).toISOString()
        core.info(`>>>>> Time: ${timeStr}, stats: ${JSON.stringify(stats)}`)
    }
}, 10000)
*/
