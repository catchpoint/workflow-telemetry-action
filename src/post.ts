import * as core from '@actions/core'

async function run(): Promise<void> {
  try {
    core.info(`[WM] Finishing ...`)

    core.info(`[WM] Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
