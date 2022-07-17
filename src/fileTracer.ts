import { ChildProcess, spawn, exec } from 'child_process';
import path from 'path';
import * as core from '@actions/core';
import si from 'systeminformation'
import { sprintf } from 'sprintf-js';
import { parse } from './fileTraceParser';
import { FileEvent } from "./interfaces";
import * as logger from './logger';
import { Octokit } from '@octokit/action';
import * as github from '@actions/github';

const FILE_TRACER_PID_KEY: string = 'FILE_TRACER_PID'
const FILE_TRACER_OUTPUT_FILE_NAME: string = 'file-trace.out'
const FILE_TRACER_BINARY_NAME_UBUNTU_20: string = 'file-tracer_ubuntu_20'

// From "https://github.com/torvalds/linux/blob/master/include/uapi/asm-generic/fcntl.h"
// #define O_ACCMODE	00000003
const O_ACCMODE: number = 3
// #define O_DIRECTORY	00200000	/* must be a directory */
const O_DIRECTORY: number = 2 << (3 * 5)

let finished: boolean = false

async function getFileTracerBinaryName(): Promise<string | null> {
    const osInfo: si.Systeminformation.OsData = await si.osInfo()
    if (osInfo) {
        // Check whether we are running on Ubuntu
        if (osInfo.distro === 'Ubuntu') {
           const majorVersion: number = parseInt(osInfo.release.split('.')[0])
           if (majorVersion === 20) {
               return FILE_TRACER_BINARY_NAME_UBUNTU_20
           }
        }
    }

    logger.info(`File tracing disabled because of unsupported OS: ${JSON.stringify(osInfo)}`)

    return null
}

///////////////////////////

export async function start(): Promise<void> {
    logger.info(`Starting file tracer ...`)

    try {
        const fileTracerBinaryName: string | null = await getFileTracerBinaryName()
        if (fileTracerBinaryName) {
            const fileTraceOutFilePath = path.join(__dirname, '../file-tracer', FILE_TRACER_OUTPUT_FILE_NAME)
            const child: ChildProcess = spawn(
                'sudo',
                [
                    path.join(__dirname, `../file-tracer/${fileTracerBinaryName}`),
                    '-p', `${process.env.GITHUB_WORKSPACE}`,
                    '-f', 'json',
                    '-o', fileTraceOutFilePath
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

            core.saveState(FILE_TRACER_PID_KEY, child.pid?.toString())

            logger.info(`Started file tracer`)
        }
    } catch (error: any) {
        logger.error('Unable to start file tracer')
        logger.error(error)
    }
}

export async function finish(): Promise<void> {
    logger.info(`Finishing file tracer ...`)

    const fileTracerPID: string = core.getState(FILE_TRACER_PID_KEY)
    if (!fileTracerPID) {
        logger.info(`Skipped finishing file tracer since file tracer didn't started`)
        return
    }
    try {
        logger.debug(`Interrupting file tracer with pid ${fileTracerPID} to stop gracefully ...`)

        await exec(`sudo kill -s INT ${fileTracerPID}`)
        finished = true

        logger.info(`Finished file tracer`)
    } catch (error: any) {
        logger.error('Unable to finish file tracer')
        logger.error(error)
    }
}

function shouldIgnoreFileEvent(event: FileEvent): boolean {
    // Check whether it is accessed from Git
    if (event.procName === 'git') {
        logger.debug(`Ignoring trace file event as it is accessed from git`)
        return true;
    }

    // Check whether file is located in the workspace
    if (process.env.GITHUB_WORKSPACE && !event.fileName.startsWith(process.env.GITHUB_WORKSPACE)) {
        logger.debug(`Ignoring trace file event as it is not located in the workspace at ${process.env.GITHUB_WORKSPACE}`)
        return true
    }

    // Check whether it is directory
    if ((event.flags & O_DIRECTORY) == O_DIRECTORY) {
        logger.debug(`Ignoring trace file event as it is directory`)
        return true
    }

    // Check whether it is read-only access
    if ((event.flags & O_ACCMODE) != 0) {
        logger.debug(`Ignoring trace file event as it is not read-only access`)
        return true
    }

    return false
}

export async function report(): Promise<void> {
    logger.info(`Reporting file tracer result ...`)

    if (!finished) {
        logger.info(`Skipped reporting file tracer since file tracer didn't finished`)
        return
    }
    try {
        const fileTraceOutFilePath = path.join(__dirname, '../file-tracer', FILE_TRACER_OUTPUT_FILE_NAME)

        logger.info(`Getting file tracer result from file ${fileTraceOutFilePath} ...`)

        const fileEvents: FileEvent[] =
            await parse(fileTraceOutFilePath, {})

        const filteredFileEvents: FileEvent[] =
            fileEvents.filter((fileEvent: FileEvent) => {
                return !shouldIgnoreFileEvent(fileEvent)
            })

        const accessedFileMap: Map<string, number> = new Map<string, number>()
        for (let event of filteredFileEvents) {
            let count: number = accessedFileMap.get(event.fileName) || 0
            accessedFileMap.set(event.fileName, ++count)
        }
        const sortedAccessedFileMap: Map<string, number> =
            new Map([...accessedFileMap.entries()].sort((a, b) => b[1] - a[1]))

        try {
            await reportNotUsedFilesInPR(sortedAccessedFileMap)
        } catch (error: any) {
            logger.error('Unable to report not used files in PR')
            logger.error(error)
        }

        try {
            await reportAccessedFiles(sortedAccessedFileMap)
        } catch (error: any) {
            logger.error('Unable to report accessed files')
            logger.error(error)
        }

        logger.info(`Reported file tracer result`)
    } catch (error: any) {
        logger.error('Unable to report file tracer result')
        logger.error(error)
    }
}

async function reportNotUsedFilesInPR(sortedAccessedFileMap: Map<string, number>): Promise<void> {
    const { pull_request } = github.context.payload
    if (pull_request) {
        if (logger.isDebugEnabled()) {
            logger.info(`Pull request: ${JSON.stringify(pull_request)}`)
        }

        const octokit: Octokit = new Octokit()

        const response = await octokit.rest.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pull_request.number,
        })

        if (logger.isDebugEnabled()) {
            logger.info(`Response: ${JSON.stringify(response)}`)
        }

        if (response.status === 200 && response.data && response.data.length) {
            const notUsedFiles: string[] = []

            for (let file of response.data) {
                if (file.filename.startsWith('.github/')) {
                    continue
                }
                if (file.status === 'added' || file.status === 'modified') {
                    const filePath: string = `${process.env.GITHUB_WORKSPACE}/${file.filename}`
                    if (logger.isDebugEnabled()) {
                        logger.info(`Changed file path: ${filePath}`)
                    }
                    const accessed: boolean = sortedAccessedFileMap.has(filePath)
                    if (!accessed) {
                        if (logger.isDebugEnabled()) {
                            logger.debug(`Not used file in PR: ${file.filename}`)
                        }
                        notUsedFiles.push(file.filename)
                    }
                }
            }

            if (logger.isDebugEnabled()) {
                logger.debug(`Not used files in PR: ${JSON.stringify(notUsedFiles)}`)
            }

            const fileInfos: string[] = []

            for (let notUsedFile of notUsedFiles) {
                fileInfos.push(`- ${notUsedFile}`)
            }

            const postContentItems: string[] = [
                '',
                '### Not Used Files in PR',
                '',
                '```' + '\n' + fileInfos.join('\n') + '\n' + '```',
            ]

            const postContent: string = postContentItems.join('\n')

            const jobSummary: string = core.getInput('job_summary')
            if ('true' === jobSummary) {
                core.summary.addRaw(postContent)
                await core.summary.write()
            }
        }
    }
}

async function reportAccessedFiles(sortedAccessedFileMap: Map<string, number>): Promise<void> {
    const fileInfos: string[] = []

    fileInfos.push(sprintf("%10s %s", "COUNT", "FILE NAME"))
    for (let entry of sortedAccessedFileMap.entries()) {
        fileInfos.push(sprintf("%10d %s", entry[1], entry[0]))
    }

    const postContentItems: string[] = [
        '',
        '### Accessed Files',
        '',
        '```' + '\n' + fileInfos.join('\n') + '\n' + '```',
    ]

    const postContent: string = postContentItems.join('\n')

    const jobSummary: string = core.getInput('job_summary')
    if ('true' === jobSummary) {
        core.summary.addRaw(postContent)
        await core.summary.write()
    }
}
