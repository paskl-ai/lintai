import { createSlice } from '@reduxjs/toolkit'
import type { Draft, PayloadAction } from '@reduxjs/toolkit'
import { JobStatus, ScanType } from '../../../api/services/types'

interface IInitialState {
  isProcessing: boolean
  jobStatus: JobStatus
  jobId?: string
  jobType?: ScanType
  progress?: number
  error?: string
}

const initialState: IInitialState = {
  isProcessing: false,
  jobStatus: 'pending',
  jobId: undefined,
  jobType: undefined,
  progress: undefined,
  error: undefined,
}

export const serverStatusSlice = createSlice({
  name: 'serverStatus',
  initialState,
  reducers: {

    // When a job is created, store its ID and initial status, and set processing to true
    startJob: (
      state: Draft<IInitialState>,
      action: PayloadAction<{
        jobId: string
        jobStatus?: JobStatus
        jobType?: ScanType
        progress?: number
      }>,
    ) => {
      state.jobId = action.payload.jobId
      state.jobStatus = action.payload.jobStatus || 'starting'
      state.jobType = action.payload.jobType
      state.progress = action.payload.progress
      state.isProcessing = true
      state.error = undefined
    },
    // Update the job status; if the status reaches 'completed', 'failed', or 'stopped', disable processing
    updateJobStatus: (
      state: Draft<IInitialState>,
      action: PayloadAction<{
        status: JobStatus
        progress?: number
        error?: string
      }>,
    ) => {
      state.jobStatus = action.payload.status
      state.progress = action.payload.progress
      state.error = action.payload.error
      
      if (
        action.payload.status === 'completed' ||
        action.payload.status === 'failed' ||
        action.payload.status === 'stopped'
      ) {
        state.isProcessing = false
      }
    },
    // Reset the job details (optional: use on errors or once finished)
    resetJob: (state: Draft<IInitialState>) => {
      state.jobStatus = 'pending'
      state.jobId = undefined
      state.jobType = undefined
      state.progress = undefined
      state.error = undefined
      state.isProcessing = false
    },
  },
})

export const { startJob, updateJobStatus, resetJob } =
  serverStatusSlice.actions

export default serverStatusSlice.reducer
