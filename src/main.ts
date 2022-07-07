import * as core from '@actions/core'
import * as statCollector from './statCollector';
import * as processTracer from './processTracer';
import * as logger from './logger'

async function run(): Promise<void> {
  try {
    logger.info(`Initializing ...`)

    // Start stat collector
    await statCollector.start()
    // Start process tracer
    await processTracer.start()

    logger.info(`Initialization completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
