import * as core from '@actions/core'
import * as statCollector from './statCollector';
import * as processTracer from './processTracer';
import * as logger from './logger'
import { WORKFLOW_TELEMETRY_SERVER_PORT } from './utils';

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)
    const port = parseInt(core.getState(WORKFLOW_TELEMETRY_SERVER_PORT));
    logger.info(`SERVER_PORT: ${port}`)
    // Finish stat collector
    await statCollector.finish(port)
    // Finish process tracer
    await processTracer.finish()

    // Report stat collector
    await statCollector.report(port)
    await statCollector.sendData(port)
    // Report process tracer
    await processTracer.report()

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
