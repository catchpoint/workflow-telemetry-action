import * as core from '@actions/core'
import * as statCollector from './statCollector';
import * as processTracer from './processTracer';
import * as logger from './logger'

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)
    logger.info(`SERVER_PORT: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`)
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    // Finish stat collector
    await statCollector.finish(port)
    // Finish process tracer
    await processTracer.finish()

    // Report stat collector
    await statCollector.report(port)
    // Report process tracer
    await processTracer.report()

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
