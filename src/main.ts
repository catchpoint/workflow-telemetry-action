import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    core.info(`[WM] Initialing ...`)

    core.info(`[WM] Initialing completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
