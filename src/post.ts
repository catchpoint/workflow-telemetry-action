import * as core from '@actions/core'
import * as statCollector from './statCollector';
import * as processTracer from './processTracer';
import * as logger from './logger'

async function run(): Promise<void> {
  try {
    logger.info(`Finishing ...`)

    // Finish stat collector
    await statCollector.finish()
    // Finish process tracer
    await processTracer.finish()

    // Report stat collector
    await statCollector.report()
    // Report process tracer
    await processTracer.report()

    logger.info(`Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

run()
