export type JobStatus = 'pending' | 'starting' | 'running' | 'completed' | 'failed' | 'stopped';

export type AnalysisType = 'find_issues' | 'catalog_ai';

export interface JobResult {
  run_id: string;
  status: JobStatus;
  progress?: number;
  message?: string;
  error?: string;
}

export interface FindingsJobResult extends JobResult {
  data?: FindingsReport;
  report?: FindingsReport;
  findings?: Finding[];
}

export interface CatalogJobResult extends JobResult {
  data?: CatalogReport;
  report?: CatalogReport;
}

export interface FindingsReport {
  findings: Finding[];
  summary?: FindingsSummary;
  metadata?: AnalysisMetadata;
}

export interface CatalogReport {
  inventory_by_file: InventoryRecord[];
  summary?: CatalogSummary;
  metadata?: AnalysisMetadata;
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

export interface FindingsSummary {
  total_findings: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  files_scanned: number;
}

export interface CatalogSummary {
  total_files: number;
  total_components: number;
  frameworks_count: number;
  unique_frameworks: string[];
}

export interface AnalysisMetadata {
  analysis_type: AnalysisType;
  analyzed_path: string;
  analysis_duration: number;
  timestamp: string;
  depth?: number;
  log_level?: string;
}

export interface LastAnalysisResult {
  type: AnalysisType;
  date: string;
  analyzed_path: string;
  errors?: string[];
  report: FindingsReport | CatalogReport;
}

export interface UseJobOptions {
  jobType: AnalysisType;
  enableLastResultFetch?: boolean;
  refetchInterval?: number;
  onJobComplete?: (result: any, resultPath?: string) => void;
  onJobError?: (error: any) => void;
}

export interface JobState {
  isProcessing: boolean;
  jobId?: string;
  jobStatus: JobStatus;
  currentResult?: FindingsJobResult | CatalogJobResult;
  lastResult?: LastAnalysisResult;
  error?: string;
}
