import { ChildProcess, spawn, exec } from 'child_process'
import path from 'path'
import * as core from '@actions/core'
import si from 'systeminformation'
import { sprintf } from 'sprintf-js'
import { parse } from './procTraceParser'
import { CompletedCommand, WorkflowJobType } from './interfaces'
import * as logger from './logger'

const PROC_TRACER_PID_KEY = 'PROC_TRACER_PID'
const PROC_TRACER_OUTPUT_FILE_NAME = 'proc-trace.out'
const PROC_TRACER_BINARY_NAME_UBUNTU_20 = 'proc-tracer_ubuntu_20'

let finished = false

async function getProcessTracerBinaryName(): Promise<string | null> {
  const osInfo: si.Systeminformation.OsData = await si.osInfo()
  if (osInfo) {
    // Check whether we are running on Ubuntu
    if (osInfo.distro === 'Ubuntu') {
      const majorVersion: number = parseInt(osInfo.release.split('.')[0])
      if (majorVersion === 20) {
        return PROC_TRACER_BINARY_NAME_UBUNTU_20
      }
    }
  }

  logger.info(
    `Process tracing disabled because of unsupported OS: ${JSON.stringify(
      osInfo
    )}`
  )

  return null
}

///////////////////////////

export async function start(): Promise<boolean> {
  logger.info(`Starting process tracer ...`)

  try {
    const procTracerBinaryName:
      | string
      | null = await getProcessTracerBinaryName()
    if (procTracerBinaryName) {
      const procTraceOutFilePath = path.join(
        __dirname,
        '../proc-tracer',
        PROC_TRACER_OUTPUT_FILE_NAME
      )
      const child: ChildProcess = spawn(
        'sudo',
        [
          path.join(__dirname, `../proc-tracer/${procTracerBinaryName}`),
          '-f',
          'json',
          '-o',
          procTraceOutFilePath
        ],
        {
          detached: true,
          stdio: 'ignore',
          env: {
            ...process.env
          }
        }
      )
      child.unref()

      core.saveState(PROC_TRACER_PID_KEY, child.pid?.toString())

      logger.info(`Started process tracer`)

      return true
    } else {
      return false
    }
  } catch (error: any) {
    logger.error('Unable to start process tracer')
    logger.error(error)

    return false
  }
}

export async function finish(currentJob: WorkflowJobType): Promise<boolean> {
  logger.info(`Finishing process tracer ...`)

  const procTracePID: string = core.getState(PROC_TRACER_PID_KEY)
  if (!procTracePID) {
    logger.info(
      `Skipped finishing process tracer since process tracer didn't started`
    )
    return false
  }
  try {
    logger.debug(
      `Interrupting process tracer with pid ${procTracePID} to stop gracefully ...`
    )

    exec(`sudo kill -s INT ${procTracePID}`)
    finished = true

    logger.info(`Finished process tracer`)

    return true
  } catch (error: any) {
    logger.error('Unable to finish process tracer')
    logger.error(error)

    return false
  }
}

export async function report(
  currentJob: WorkflowJobType
): Promise<string | null> {
  logger.info(`Reporting process tracer result ...`)

  if (!finished) {
    logger.info(
      `Skipped reporting process tracer since process tracer didn't finished`
    )
    return null
  }
  try {
    const procTraceOutFilePath = path.join(
      __dirname,
      '../proc-tracer',
      PROC_TRACER_OUTPUT_FILE_NAME
    )

    logger.info(
      `Getting process tracer result from file ${procTraceOutFilePath} ...`
    )

    let minProcDuration = -1
    const minProcDurationInput: string = core.getInput('min_proc_duration')
    if (minProcDurationInput) {
      const minProcDurationVal: number = parseInt(minProcDurationInput)
      if (Number.isInteger(minProcDurationVal)) {
        minProcDuration = minProcDurationVal
      }
    }

    const traceSysProcs: boolean = core.getInput('trace_sys_procs') === 'true'

    const completedCommands: CompletedCommand[] = await parse(
      procTraceOutFilePath,
      {
        minDuration: minProcDuration,
        traceSystemProcesses: traceSysProcs
      }
    )

    const commandInfos: string[] = []
    commandInfos.push(
      sprintf(
        '%-12s %-16s %7s %7s %7s %15s %15s %10s %-20s',
        'TIME',
        'NAME',
        'UID',
        'PID',
        'PPID',
        'START TIME',
        'DURATION (ms)',
        'EXIT CODE',
        'FILE NAME + ARGS'
      )
    )
    for (const command of completedCommands) {
      commandInfos.push(
        sprintf(
          '%-12s %-16s %7d %7d %7d %15d %15d %10d %s %s',
          command.ts,
          command.name,
          command.uid,
          command.pid,
          command.ppid,
          command.startTime,
          command.duration,
          command.exitCode,
          command.fileName,
          command.args.join(' ')
        )
      )
    }

    const postContentItems: string[] = [
      '',
      '### Process Traces',
      '',
      '```' + '\n' + commandInfos.join('\n') + '\n' + '```'
    ]
    const postContent: string = postContentItems.join('\n')

    logger.info(`Reported process tracer result`)

    return postContent
  } catch (error: any) {
    logger.error('Unable to report process tracer result')
    logger.error(error)

    return null
  }
}
