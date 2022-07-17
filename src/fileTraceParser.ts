import * as fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import * as logger from './logger';
import { FileEvent, FileEventParseOptions } from './interfaces';

function resolveFileNameIfRelative(event: any): void {
    // Check whether file name is relative path
    if (event.fileName && event.fileName.charAt(0) !== '/') {
        // If the file name is relative path, resolve real path
        const resolvedFileName: string = path.resolve(event.pwd, event.fileName)
        if (logger.isDebugEnabled()) {
            logger.debug(`Resolved file name ${event.fileName} to ${resolvedFileName}`)
        }
        event.fileName = resolvedFileName
    }
}

export async function parse(filePath: string, fileEventParseOptions: FileEventParseOptions): Promise<FileEvent[]> {
    const fileStream: fs.ReadStream = fs.createReadStream(filePath)
    const rl: readline.Interface = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    })
    // Note: we use the crlfDelay option to recognize all instances of CR LF
    // ('\r\n') in input file as a single line break.

    const fileEvents: FileEvent[] = []

    for await (let line of rl) {
        line = line.trim()
        if (!line || !line.length) {
            continue
        }
        try {
            const event = JSON.parse(line)
            if (logger.isDebugEnabled()) {
                logger.debug(`Parsing trace file event: ${line}`)
            }

            resolveFileNameIfRelative(event)

            fileEvents.push({
                time: event.time,
                procName: event.procName,
                uid: event.uid,
                pid: event.pid,
                ppid: event.ppid,
                pwdDepth: event.pwdDepth,
                pwd: event.pwd,
                fileName: event.fileName,
                flags: event.flags,
                mode: event.mode
            } as FileEvent)
        } catch (error: any) {
            logger.debug(`Unable to parse file trace event (${error}): ${line}`)
        }
    }

    fileEvents.sort((a: FileEvent, b: FileEvent) => {
        return a.time - b.time
    })

    if (logger.isDebugEnabled()) {
        logger.debug(`File events: ${JSON.stringify(fileEvents)}`)
    }

    return fileEvents
}
