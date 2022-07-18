import { WorkflowJobType } from './interfaces'
import * as logger from './logger'

function generateTraceChartForSteps(job: WorkflowJobType): string {
  let chartContent = ''

  /**
     gantt
       title Build
       dateFormat x
       axisFormat %H:%M:%S
       Set up job : milestone, 1658073446000, 1658073450000
       Collect Workflow Telemetry : 1658073450000, 1658073450000
       Run actions/checkout@v2 : 1658073451000, 1658073453000
       Set up JDK 8 : 1658073453000, 1658073458000
       Build with Maven : 1658073459000, 1658073654000
       Run invalid command : crit, 1658073655000, 1658073654000
       Archive test results : done, 1658073655000, 1658073654000
       Post Set up JDK 8 : 1658073655000, 1658073654000
       Post Run actions/checkout@v2 : 1658073655000, 1658073655000
  */

  chartContent = chartContent.concat('gantt', '\n')
  chartContent = chartContent.concat('\t', `title ${job.name}`, '\n')
  chartContent = chartContent.concat('\t', `dateFormat x`, '\n')
  chartContent = chartContent.concat('\t', `axisFormat %H:%M:%S`, '\n')

  for (const step of job.steps || []) {
    if (!step.started_at || !step.completed_at) {
      continue
    }
    chartContent = chartContent.concat('\t', `${step.name} : `)

    if (step.name === 'Set up job' && step.number === 1) {
      chartContent = chartContent.concat('milestone, ')
    }

    if (step.conclusion === 'failure') {
      // to show red
      chartContent = chartContent.concat('crit, ')
    } else if (step.conclusion === 'skipped') {
      // to show grey
      chartContent = chartContent.concat('done, ')
    }

    const startTime: number = new Date(step.started_at).getTime()
    const finishTime: number = new Date(step.completed_at).getTime()
    chartContent = chartContent.concat(
      `${Math.min(startTime, finishTime)}, ${finishTime}`,
      '\n'
    )
  }

  const postContentItems: string[] = [
    '',
    '### Step Trace',
    '',
    '```mermaid' + '\n' + chartContent + '\n' + '```'
  ]
  return postContentItems.join('\n')
}

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting step tracer ...`)

  try {
    logger.info(`Started step tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to start step tracer')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing step tracer ...`)

  try {
    logger.info(`Finished step tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish step tracer')
    logger.error(error)

    return false
  }
}

export async function report(
  currentJob: WorkflowJobType
): Promise<string | null> {
  logger.info(`Reporting step tracer result ...`)

  if (!currentJob) {
    return null
  }

  try {
    const postContent: string = generateTraceChartForSteps(currentJob)

    logger.info(`Reported step tracer result`)

    return postContent
  } catch (error: any) {
    logger.error('Unable to report step tracer result')
    logger.error(error)

    return null
  }
}
