import * as core from '@actions/core'
import si from 'systeminformation'

const STATS_FREQ: number = 5000
let statCollectTime: number = 0

// Network Stats         //
///////////////////////////

interface NetworkStats {
  readonly rxKb: number
  readonly txKb: number
}

const networkStatsHistogram: Map<number, NetworkStats> = new Map<
  number,
  NetworkStats
>()

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
        rxKb: Math.floor((totalRxSec * (timeInterval / 1000)) / 1024),
        txKb: Math.floor((totalTxSec * (timeInterval / 1000)) / 1024)
      }
      networkStatsHistogram.set(statTime, networkStats)
    })
    .catch((error: any) => {
      core.error(error)
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

core.info('>>>>> Starting stat collector ...')

setInterval(collectStats, STATS_FREQ)

setInterval(() => {
  core.info('>>>>> Dumping network stats ...')
  for (let [time, stats] of networkStatsHistogram.entries()) {
    const timeStr: string = new Date(time).toISOString()
    core.info(`>>>>> Time: ${timeStr}, stats: ${JSON.stringify(stats)}`)
  }
}, 10000)
