export interface JobInfo {
    readonly id?: number
    readonly name?: string
    readonly runAttempt?: number | undefined
}

export interface MetaData {
    readonly CIProvider: string
    readonly RunId: number
    readonly RepoName: string
    readonly RepoOwner: string
    readonly RunnerName?: string | undefined
    readonly JobId?: number | undefined
    readonly JobName?: string | undefined
    readonly JobRunAttempt?: number | undefined
}

export interface CITelemetryData {
    readonly metadata: MetaData;
    readonly workflowData: WorkflowDatum[]
}
 
export interface WorkflowDatum {
    readonly version: string
    readonly data: Object
    readonly type: string
}

export interface MetricStats {
    readonly time: number
    readonly metricName: string
}

export interface CPUStats extends MetricStats {
    readonly totalLoad: number
    readonly userLoad: number
    readonly systemLoad: number
}

export interface MemoryStats extends MetricStats {
    readonly totalMemoryMb: number
    readonly activeMemoryMb: number
    readonly availableMemoryMb: number
}

export interface NetworkStats extends MetricStats {
    readonly rxMb: number
    readonly txMb: number
}

export interface DiskStats extends MetricStats {
    readonly time: number
    readonly rxMb: number
    readonly wxMb: number
}

export interface ProcessedStats {
    readonly x: number,
    readonly y: number
}

export interface ProcessedCPUStats {
    readonly userLoadX: ProcessedStats[],
    readonly systemLoadX: ProcessedStats[],
}

export interface ProcessedMemoryStats {
    readonly activeMemoryX: ProcessedStats[],
    readonly availableMemoryX: ProcessedStats[],
}

export interface ProcessedNetworkStats {
    readonly networkReadX: ProcessedStats[],
    readonly networkWriteX: ProcessedStats[],
}

export interface ProcessedDiskStats {
    readonly diskReadX: ProcessedStats[],
    readonly diskWriteX: ProcessedStats[],
}

export interface LineGraphOptions {
    readonly label: string,
    readonly line: {
        readonly label: string,
        readonly color: string,
        readonly points: ProcessedStats[]
    }
}

export interface StackedArea {
    readonly label: string,
    readonly color: string,
    readonly points: ProcessedStats[]
}

export interface StackedAreaGraphOptions {
    readonly label: string,
    readonly areas: StackedArea[]
}

export interface GraphResponse {
    readonly id: string,
    readonly url: string
}

export interface CompletedCommand {
    readonly ts: string,
    readonly event: string,
    readonly name: string,
    readonly uid: number,
    readonly pid: number,
    readonly ppid: string,
    readonly startTime: number,
    readonly fileName: string,
    readonly args: string[],
    readonly duration: number,
    readonly exitCode: number
}

export interface ProcEventParseOptions {
    readonly minDuration: number,
    readonly traceSystemProcesses: boolean
}
