# workflow-telemetry-action

A GitHub Action to track and monitor the resource metrics of your GitHub Action workflow runs. If the run is triggered via a Pull Request, it will create a comment on the connected PR with the results. The action collects the following metrics:

- CPU Load (user and system) in percentage
- Memory usage (used and free) in MB
- Network I/O (read and write) in MB
- Disk I/O (read and write) in MB

### Example Output

An example output of a simple workflow run will look like this.

![PR Comment Example](/images/pr-comment-example.png)

## Usage

To use the action, add the following step before the steps you want to track.

```yaml
- name: Collect Workflow Telemetry
  uses: thundra-io/workflow-telemetry-action@v1
```
