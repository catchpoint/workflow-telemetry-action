import * as core from '@actions/core'
import * as stepTracer from './stepTracer'
import * as statCollector from './statCollector'
import * as processTracer from './processTracer'
import * as logger from './logger'

async function run(): Promise<void> {
  try {
    logger.info(`Initializing ...`)

    // Start step tracer
    await stepTracer.start()
    // Start stat collector
    await statCollector.start()
    // Start process tracer
    await processTracer.start()

    logger.info(`Initialization completed`)
  } catch (error: any) {
    logger.error(error.message)
    core.notice(error.message);
  }
}

run()
