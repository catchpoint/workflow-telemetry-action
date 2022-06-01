import * as core from '@actions/core'
import path from 'path'
import { ChildProcess, spawn } from 'child_process'
import * as logger from './logger'

let statFrequency: number
const statFrequencyInput: string = core.getInput('stat_frequency')
if (statFrequencyInput) {
  const statFrequencyVal: number = parseInt(statFrequencyInput)

  if (Number.isInteger(statFrequencyVal)) {
    statFrequency = statFrequencyVal * 1000
  }
}

async function run(): Promise<void> {
  try {
    logger.info(`Initializing ...`)

    const child: ChildProcess = spawn(
      process.argv[0],
      [path.join(__dirname, '../sc/index.js')],
      {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          FORESIGHT_WORKFLOW_TELEMETRY_STAT_FREQ: `${statFrequency}`
        }
      }
    )
    child.unref()

    logger.info(`Initialization completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
