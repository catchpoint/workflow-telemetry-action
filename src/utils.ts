import * as logger from './logger';
import * as core from '@actions/core'
import { CITelemetryData, JobInfo, MetaData, TelemetryDatum } from './interfaces';
import * as github from '@actions/github';

export const WORKFLOW_TELEMETRY_SERVER_PORT = "WORKFLOW_TELEMETRY_SERVER_PORT";

export const WORKFLOW_TELEMETRY_VERSIONS = {
    METRIC: "v1",
    PROCESS: "v1"
};

export const JOB_STATES_NAME = {
    FORESIGHT_WORKFLOW_JOB_ID: "FORESIGHT_WORKFLOW_JOB_ID",
    FORESIGHT_WORKFLOW_JOB_NAME: "FORESIGHT_WORKFLOW_JOB_NAME",
    FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT: "FORESIGHT_WORKFLOW_JOB_RUN_ATTEMPT"
}

export async function setServerPort() {
    var portfinder = require('portfinder');
    portfinder.basePort = 10000;
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = await portfinder.getPortPromise();
    }
    core.saveState(WORKFLOW_TELEMETRY_SERVER_PORT, process.env.WORKFLOW_TELEMETRY_SERVER_PORT);
    logger.info(`Workflow telemetry server port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}


export function saveJobInfos(jobInfo: JobInfo) {
    core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID, jobInfo.id)
    core.exportVariable(JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME, jobInfo.name)
}

function getJobInfo(): JobInfo {
    const jobInfo: JobInfo = {
        id: parseInt(process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_ID] || ''),
        name: process.env[JOB_STATES_NAME.FORESIGHT_WORKFLOW_JOB_NAME],
    }
    return jobInfo
}

function getMetaData(): MetaData {
    const { repo, runId } = github.context
    const jobInfo = getJobInfo();
    const metaData: MetaData = {
        ciProvider: "GITHUB",
        runId: runId,
        repoName: repo.repo,
        repoOwner: repo.owner,
        runAttempt: process.env.GITHUB_RUN_ATTEMPT,
        runnerName: process.env.RUNNER_NAME,
        jobId: jobInfo.id,
        jobName: jobInfo.name,
    }
    return metaData
}

export function createCITelemetryData(telemetryData: TelemetryDatum[]): CITelemetryData {
    return {
        metaData: getMetaData(),
        telemetryData: telemetryData
    }
}