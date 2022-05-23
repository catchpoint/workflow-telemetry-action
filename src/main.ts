import * as core from '@actions/core'
import path from 'path'

async function run(): Promise<void> {
  try {
    core.info(`[WM] Initialing ...`)

    const spawn = require('child_process').spawn
    const child = spawn(process.argv[0], [path.join(__dirname, '../sc/index.js')], {
      detached: true,
      stdio: 'ignore'
    })
    child.unref()

    core.info(`[WM] Initialing completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
