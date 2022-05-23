import * as core from '@actions/core'
import path from 'path'

async function run(): Promise<void> {
  try {
    core.info(`[WM] Initialing ...`)

    const fork = require('child_process').fork

    fork(path.join(__dirname, '../sc/index.js'), [], {
      detached: true
    })

    core.info(`[WM] Initialing completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
