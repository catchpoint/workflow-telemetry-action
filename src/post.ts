import * as core from '@actions/core'
import * as statCollector from './statCollector';
import * as processTracer from './processTracer';
import * as logger from './logger'
import { SERVER_PORT } from './utils';

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)
    logger.info(`SERVER_PORT: ${SERVER_PORT}`)
    // Finish stat collector
    await statCollector.finish(SERVER_PORT)
    // Finish process tracer
    await processTracer.finish()

    // Report stat collector
    await statCollector.report(SERVER_PORT)
    // Report process tracer
    await processTracer.report()

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
