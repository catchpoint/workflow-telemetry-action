import * as core from '@actions/core'
import http, {ClientRequest, RequestOptions} from 'http'
import { Buffer } from "buffer";

async function run(): Promise<void> {
  try {
    core.info(`[WM] Finishing ...`)

    await getNetworkStats()

    core.info(`[WM] Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

async function getNetworkStats() {
  const options: RequestOptions = {
    hostname: 'localhost',
    port: 7777,
    path: '/network',
    method: 'GET',
  };
  const req: ClientRequest = http.request(options, res => {
    console.log(`[WM] statusCode: ${res.statusCode}`)
    let buffer: Buffer = Buffer.alloc(0)
    res.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data])
    })
    res.on('end', () => {
      console.log(`[WM] Network stats: ${buffer.toString()}`)
    })
  })
  req.on('error', error => {
    console.error(error);
  });
  req.end();
}

run()
