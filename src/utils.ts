import * as logger from './logger';
export let SERVER_PORT: number;

export function setServerPort() {
    const random_port = require('random-port');
    SERVER_PORT = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '') || random_port();
    logger.info(`Random port is: ${SERVER_PORT}`);
}