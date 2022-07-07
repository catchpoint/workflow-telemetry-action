# workflow-telemetry-action

A GitHub Action to track and monitor the resource metrics and process activities of your GitHub Action workflow runs. 
If the run is triggered via a Pull Request, it will create a comment on the connected PR with the results 
and/or publishes the results to the job summary. 

The action collects the following metrics:
- CPU Load (user and system) in percentage
- Memory usage (used and free) in MB
- Network I/O (read and write) in MB
- Disk I/O (read and write) in MB

And traces the process executions with the following information (only supported on `Ubuntu`):
- Name
- Id
- Parent id
- User id
- Start time
- Duration (in ms)
- Exit code
- File name
- Arguments

### Example Output

An example output of a simple workflow run will look like this.

![PR Comment Example](/images/pr-comment-example.png)

## Usage

To use the action, add the following step before the steps you want to track.

```yaml
- name: Collect Workflow Telemetry
  uses: thundra-io/workflow-telemetry-action@v1
```

## Configuration

| Option                | Requirement       | Description
| ---                   | ---               | ---
| `github_token`        | Optional          | An alternative GitHub token, other than the default provided by GitHub Actions runner.
| `stat_frequency`      | Optional          | Statistic collection frequency in seconds. Must be a number. Defaults to `5`.
| `min_proc_duration`   | Optional          | Puts minimum limit for process execution duration to be traced. Must be a number. Defaults to `-1` which means process duration filtering is not applied.
| `trace_sys_procs`     | Optional          | Enables tracing default system processes (`aws`, `cat`, `sed`, ...). Defaults to `false`.
| `comment_on_pr`       | Optional          | Set to `true` to publish the results as comment to the PR (applicable if workflow run is triggered by PR). Defaults to `true`.
| `job_summary`         | Optional          | Set to `true` to publish the results as part of the [job summary page](https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/) of the workflow run. Defaults to `true`.
| `theme`               | Optional          | Set to `dark` to generate charts compatible with Github **dark** mode. Defaults to `light`.
