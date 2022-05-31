import * as core from '@actions/core'
import * as github from '@actions/github';
import axios, { AxiosResponse } from 'axios';

import { Octokit } from '@octokit/action'

const { pull_request } = github.context.payload;

async function run(): Promise<void> {
  try {
    core.info(`[WM] Finishing ...`)

    const rawNetworkData = await getNetworkStats()
    const { id, url } = await getNetworkGraph(rawNetworkData.data);

    const octokit = new Octokit();
    if (pull_request) {
      core.info(`[WM] Found Pull Request: ${pull_request}`)

      await octokit.rest.issues.createComment({
        ...github.context.repo,
        issue_number: Number(github.context.payload.pull_request?.number),
        body: `![${id}](${url})`
      })
    } else {
      core.info(`[WM] Couldn't Find Pull Request`)
    }

    core.info(`[WM] Finish completed`)
  } catch (error: any) {
    core.setFailed(error.message)
  }
}

async function getNetworkStats(): Promise<AxiosResponse<any, any>> {
  core.info('[WM] Get network stats!')
  const response = await axios.get('http://localhost:7777/network')

  core.info(`[WM] Got Network Data: ${JSON.stringify(response.data)}`)

  return response
}

async function getNetworkGraph(rawData: any): Promise<any> {
  let readX: any[] = []
  let writeX: any[] = []

  rawData.forEach((element: any) => {
    readX.push({
      "x": element.time,
      "y": element.rxKb
    })

    writeX.push({
      "x": element.time,
      "y": element.txKb
    })
  })

  const payload = {
    "options": {
      "width": 1000,
      "height": 500,
      "xAxis": {
        "label": "Time"
      },
      "yAxis": {
        "label": "Network I/O (KB)"
      },
      "timeTicks": {
        "unit": "auto"
      }
    },
    "lines": [
      {
        "label": "Read",
        "color": "#be4d25",
        "points": readX
      },
      {
        "label": "Write",
        "color": "#6c25be",
        "points": writeX
      }
    ]
  };

  const response = await axios.put('https://api.globadge.com/v1/chartgen/line/time', payload)

  return response.data
}

run()
