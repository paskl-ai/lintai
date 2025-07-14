export type JobStatus = 'pending' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';

export type ScanType = 'scan' | 'inventory';

export interface JobResult {
  run_id: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
}

export interface ScanJobResult extends JobResult {
  data?: ScanReport;
  report?: ScanReport;
  findings?: Finding[];
}

export interface InventoryJobResult extends JobResult {
  data?: InventoryReport;
  report?: InventoryReport;
}

export interface ScanReport {
  findings: Finding[];
  summary?: ScanSummary;
  metadata?: ScanMetadata;
}

export interface InventoryReport {
  inventory_by_file: InventoryRecord[];
  summary?: InventorySummary;
  metadata?: ScanMetadata;
}

export interface Finding {
  owasp_id: string;
  severity: 'critical' | 'blocker' | 'high' | 'medium' | 'low';
  message: string;
  location: string;
  line: number;
  fix: string;
  detector_id: string;
}

export interface InventoryRecord {
  file_path: string;
  frameworks: string[];
  components: {
    component_type: string;
    name: string;
    location: string;
    code_snippet: string;
    call_chain: string[];
    relationships: {
      target_name: string;
      type: string;
    }[];
  }[];
}

export interface ScanSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  files_scanned: number;
}

export interface InventorySummary {
  total_files: number;
  total_components: number;
  frameworks_count: number;
  unique_frameworks: string[];
}

export interface ScanMetadata {
  scan_type: ScanType;
  scanned_path: string;
  scan_duration: number;
  timestamp: string;
  depth?: number;
  log_level?: string;
}

export interface LastScanResult {
  type: ScanType;
  date: string;
  scanned_path: string;
  errors?: string[];
  report: ScanReport | InventoryReport;
}

export interface UseJobOptions {
  jobType: ScanType;
  enableLastResultFetch?: boolean;
  refetchInterval?: number;
  onJobComplete?: (result: any, resultPath?: string) => void;
  onJobError?: (error: any) => void;
}

export interface JobState {
  isProcessing: boolean;
  jobId?: string;
  jobStatus: JobStatus;
  currentResult?: ScanJobResult | InventoryJobResult;
  lastResult?: LastScanResult;
  error?: string;
}