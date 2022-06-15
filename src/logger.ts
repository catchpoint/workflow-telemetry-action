import * as core from '@actions/core'

const LOG_HEADER: string = '[Workflow Telemetry]'

export function isDebugEnabled(): boolean {
  return core.isDebug();
}

export function debug(msg: string) {
  core.debug(LOG_HEADER + ' ' + msg)
}

export function info(msg: string) {
  core.info(LOG_HEADER + ' ' + msg)
}

export function error(msg: string | Error) {
  if (msg instanceof String || typeof msg === 'string') {
    core.error(LOG_HEADER + ' ' + msg)
  } else {
    core.error(LOG_HEADER + ' ' + (msg as Error).name)
    core.error(msg as Error)
  }
}
