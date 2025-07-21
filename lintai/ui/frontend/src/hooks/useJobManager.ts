import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../redux/services/store';
import { resetJob, updateJobStatus } from '../redux/services/ServerStatus/server.status.slice';
import { AnalysisService } from '../api/services/Scan/analysis.api';
import { UseJobOptions, AnalysisType, JobState } from '../api/services/types';

export const useJobManager = (options: UseJobOptions) => {
  const {
    jobType,
    enableLastResultFetch = true,
    refetchInterval = 3000,
    onJobComplete,
    onJobError
  } = options;

  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { jobId: runId, isProcessing } = useAppSelector(state => state.serverStatus);

  // Query for fetching current job results (polling while job is active)
  const {
    data: currentResult,
    isFetching: isFetchingCurrentResult,
    error: currentResultError
  } = useQuery({
    queryKey: ['job'+jobType, jobType, runId],
    queryFn: async () => {
      if (!runId) return null;

      const result = await AnalysisService.getResults(runId);

      // Check if job is complete - both scan and inventory have data when complete
      const hasData = result?.data || result?.report ||
                     (result as any)?.findings ||
                     (result as any)?.inventory_by_file ||
                     (result as any)?.findings_by_file;

      if (hasData) {
        toast.dismiss();

        const jobRunId = result?.run_id || runId;
        const resultPath = jobType === 'find_issues' ? `/findings/${jobRunId}` : `/catalog/${jobRunId}`;

        // Show completion toast with option to view results
        toast.success(
          `${jobType === 'find_issues' ? 'Findings analysis' : 'AI catalog'} completed successfully! Click to view results.`,
          {
            autoClose: 8000,
            onClick: () => {
              window.location.href = resultPath;
            }
          }
        );

        // Reset job state
        dispatch(resetJob());

        // Trigger completion callback with result path for additional navigation
        if (onJobComplete) {
          onJobComplete(result, resultPath);
        }

        // Invalidate last result query to refetch
        queryClient.invalidateQueries({ queryKey: ['last-result', jobType] });

        // Also invalidate history queries to update the lists
        queryClient.invalidateQueries({ queryKey: ['scan-history'] });
        queryClient.invalidateQueries({ queryKey: ['inventory-history'] });
      }

      return result;
    },
    enabled: !!runId && isProcessing,
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? refetchInterval : false,
    retry: (failureCount, error) => {
      // Only retry network errors, not application errors
      if (failureCount < 3) {

          dispatch(resetJob());
          toast.error(`Error fetching ${jobType} results: ${currentResultError?.detail}`)


        return true;
      }
      return false;
    }
  });


  // Query for fetching last scan results (shown when no active job)
  const {
    data: lastResult,
    isLoading: isLoadingLastResult,
    error: lastResultError
  } = useQuery({
    queryKey: ['last-result', jobType],
    queryFn: () => AnalysisService.getLastResultsByType(jobType),
    enabled: enableLastResultFetch && !isProcessing,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });

  // Determine which result to show
  const activeResult = isProcessing ? currentResult : lastResult;
  const isLoading = isProcessing ? isFetchingCurrentResult : isLoadingLastResult;
  const error = currentResultError || lastResultError;

  // Extract the actual report/data from the result
  const report = (activeResult as any)?.report || (activeResult as any)?.data || null;
  const findings = jobType === 'find_issues' ? (report?.findings || []) : [];
  const inventory = jobType === 'catalog_ai' ? (report?.inventory_by_file || []) : [];

  // Job state summary
  const jobState: JobState = {
    isProcessing,
    jobId: runId,
    jobStatus: (isProcessing ? 'running' : 'completed') as any,
    currentResult: isProcessing ? (currentResult || undefined) : undefined,
    lastResult: !isProcessing ? (lastResult || undefined) : undefined,
    error: error?.message
  };

  // Helper function to invalidate queries for this job type
  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['job', jobType] });
    queryClient.invalidateQueries({ queryKey: ['last-result', jobType] });
  };

  return {
    // Main data
    report,
    findings,
    inventory,

    // Loading states
    isLoading,
    isFetchingCurrentResult,
    isLoadingLastResult,

    // Job state
    jobState,
    isProcessing,

    // Errors
    error,

    // Utilities
    invalidateQueries,

    // Raw results for advanced use cases
    currentResult,
    lastResult,
    activeResult
  };
};
