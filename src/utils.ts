import * as logger from './logger';

export async function setServerPort() {
    const random_port = require('random-port');
    const port = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '');
    if(!port) {
        random_port((port: number) => {
            process.env["WORKFLOW_TELEMETRY_SERVER_PORT"] = port.toString();
        });
    }
    logger.info(`Random port is: ${process.env.WORKFLOW_TELEMETRY_SERVER_PORT}`);
}