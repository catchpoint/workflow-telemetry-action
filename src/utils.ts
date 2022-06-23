var random_port = require('random-port');

export let SERVER_PORT: number;

export async function setServerPort() {
    SERVER_PORT = parseInt(process.env.WORKFLOW_TELEMETRY_SERVER_PORT || '') || await random_port();
}