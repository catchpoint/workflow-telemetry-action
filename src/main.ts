import * as core from '@actions/core'
import path from 'path'
import { ChildProcess, spawn } from "child_process"

async function run(): Promise<void> {
  try {
    core.info(`[WM] Initialing ...`)

    const child: ChildProcess =
        spawn(
          process.argv[0],
          [path.join(__dirname, '../sc/index.js')],
          {
            detached: true,
            stdio: 'ignore'
          })
    child.unref()

    core.info(`[WM] Initialization completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
