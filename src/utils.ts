import * as logger from './logger';

export async function setServerPort() {
    var portfinder = require('portfinder');
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = await portfinder.getPort();
    }
    logger.info(`Random port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}