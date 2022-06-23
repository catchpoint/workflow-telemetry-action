import * as logger from './logger';

export async function setServerPort() {
    const random_port = require('random-port');
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = await random_port();
    }
    logger.info(`Random port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}