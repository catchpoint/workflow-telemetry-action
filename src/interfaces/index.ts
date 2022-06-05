export interface JobInfo {
    readonly id?: number
    readonly name?: string
}

export interface CPUStats {
    readonly time: number
    readonly totalLoad: number
    readonly userLoad: number
    readonly systemLoad: number
}

export interface NetworkStats {
    readonly time: number
    readonly rxMb: number
    readonly txMb: number
}

export interface DiskStats {
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
