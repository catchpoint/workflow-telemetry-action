import * as fs from 'fs'
import * as readline from 'readline'
import * as logger from './logger'
import { CompletedCommand, ProcEventParseOptions } from './interfaces'

const SYS_PROCS_TO_BE_IGNORED: Set<string> = new Set([
  'awk',
  'basename',
  'cat',
  'cut',
  'date',
  'expr',
  'dirname',
  'grep',
  'head',
  'ls',
  'lsblk',
  'id',
  'ip',
  'ps',
  'sed',
  'sh',
  'uname'
])

export async function parse(
  filePath: string,
  procEventParseOptions: ProcEventParseOptions
): Promise<CompletedCommand[]> {
  const minDuration: number =
    (procEventParseOptions && procEventParseOptions.minDuration) || -1
  const traceSystemProcesses: boolean =
    (procEventParseOptions && procEventParseOptions.traceSystemProcesses) ||
    false

  const fileStream: fs.ReadStream = fs.createReadStream(filePath)
  const rl: readline.Interface = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  })
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') in input file as a single line break.

  let execCommandCount: number = 0
  let exitCommandCount: number = 0
  let unknownCommandCount: number = 0
  const activeCommands: Map<number, any> = new Map<number, any>()
  const replacedCommands: Map<number, any> = new Map<number, any>()
  const completedCommands: CompletedCommand[] = []

  for await (let line of rl) {
    line = line.trim()
    if (!line || !line.length) {
      continue
    }
    try {
      const event = JSON.parse(line)
      if (logger.isDebugEnabled()) {
        logger.debug(`Parsing trace process event: ${line}`)
      }
      if (!traceSystemProcesses && SYS_PROCS_TO_BE_IGNORED.has(event.name)) {
        continue
      }
      if ('EXEC' === event.event) {
        const existingCommand: any = activeCommands.get(event.pid)
        activeCommands.set(event.pid, event)
        if (existingCommand) {
          replacedCommands.set(event.pid, existingCommand)
        }
        execCommandCount++
      } else if ('EXIT' === event.event) {
        let activeCommandCompleted: boolean = false
        let replacedCommandCompleted: boolean = false

        // Process active command
        const activeCommand: any = activeCommands.get(event.pid)
        activeCommands.delete(event.pid)
        if (activeCommand) {
          for (let key of Object.keys(event)) {
            if (!activeCommand.hasOwnProperty(key)) {
              activeCommand[key] = event[key]
            }
          }
          activeCommandCompleted = true
        }

        // Process replaced command if there is
        const replacedCommand: any = replacedCommands.get(event.pid)
        replacedCommands.delete(event.pid)
        if (replacedCommand && activeCommandCompleted) {
          for (let key of Object.keys(event)) {
            if (!replacedCommand.hasOwnProperty(key)) {
              replacedCommand[key] = event[key]
            }
          }
          const finishTime: number =
            activeCommand.startTime + activeCommand.duration
          replacedCommand.duration = finishTime - replacedCommand.startTime
          replacedCommandCompleted = true
        }

        // Complete the replaced command first if there is
        if (
          replacedCommandCompleted &&
          replacedCommand.duration > minDuration
        ) {
          completedCommands.push(replacedCommand)
        }

        // Then complete the actual command
        if (activeCommandCompleted && activeCommand.duration > minDuration) {
          completedCommands.push(activeCommand)
        }

        exitCommandCount++
      } else {
        if (logger.isDebugEnabled()) {
          logger.debug(`Unknown trace process event: ${line}`)
        }
        unknownCommandCount++
      }
    } catch (error: any) {
      logger.debug(`Unable to parse process trace event (${error}): ${line}`)
    }
  }

  completedCommands.sort((a: CompletedCommand, b: CompletedCommand) => {
    return a.startTime - b.startTime
  })

  if (logger.isDebugEnabled()) {
    logger.debug(`Completed commands: ${JSON.stringify(completedCommands)}`)
  }

  return completedCommands
}
