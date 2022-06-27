import * as logger from './logger';
import * as core from '@actions/core'

export const WORKFLOW_TELEMETRY_SERVER_PORT = "WORKFLOW_TELEMETRY_SERVER_PORT";

export const WORKFLOW_TELEMETRY_VERSIONS = {
    METRIC: "v1",
    PROCESS: "v1"
};

export async function setServerPort() {
    var portfinder = require('portfinder');
    portfinder.basePort = 10000;
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = await portfinder.getPortPromise();
    }
    core.saveState(WORKFLOW_TELEMETRY_SERVER_PORT, process.env.WORKFLOW_TELEMETRY_SERVER_PORT);
    logger.info(`Random port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}