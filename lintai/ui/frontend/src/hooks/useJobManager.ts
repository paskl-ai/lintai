import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useAppDispatch, useAppSelector } from '../redux/services/store';
import { resetJob, updateJobStatus } from '../redux/services/ServerStatus/server.status.slice';
import { ScanService } from '../api/services/Scan/scan.api';
import { UseJobOptions, ScanType, JobState } from '../api/services/types';

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
      
      const result = await ScanService.getResults(runId);
      
      // Check if job is complete
      if (result?.data || result?.report || (result as any)?.findings||result?.inventory_by_file) {
        toast.dismiss();
        toast.success(`${jobType === 'scan' ? 'Scan' : 'Inventory scan'} completed successfully!`);
        
        // Reset job state
        dispatch(resetJob());
        
        // Trigger completion callback
        if (onJobComplete) {
          onJobComplete(result);
        }
        
        // Invalidate last result query to refetch
        queryClient.invalidateQueries({ queryKey: ['last-result', jobType] });
      }
      
      return result;
    },
    enabled: !!runId && isProcessing,
    refetchOnWindowFocus: false,
    refetchInterval: isProcessing ? refetchInterval : false,
    retry: (failureCount, error) => {
      // Only retry network errors, not application errors
      if (failureCount < 3 && error?.message?.includes('Network Error')) {
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
    queryFn: () => ScanService.getLastResultsByType(jobType),
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
  const findings = jobType === 'scan' ? (report?.findings || []) : [];
  const inventory = jobType === 'inventory' ? (report?.inventory_by_file || []) : [];

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