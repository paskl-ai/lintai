import { stat } from 'fs'

import { createSlice } from '@reduxjs/toolkit'
import type { Draft, PayloadAction } from '@reduxjs/toolkit'


interface IInitialState {

  isProcessing: boolean
  jobStatus: string
  jobId?: string
}

const initialState: IInitialState = {

  isProcessing: false,
  jobStatus: '',
  jobId: undefined,
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
        jobStatus: string
        // selectedServer: VirtualMachine
      }>,
    ) => {
      state.jobId = action.payload.jobId
      state.jobStatus = action.payload.jobStatus
      state.isProcessing = true
      // // state.selectedServer = action.payload.selectedServer
    },
    // Update the job status; if the status reaches 'started', disable processing
    updateJobStatus: (
      state: Draft<IInitialState>,
      action: PayloadAction<string>,
    ) => {
      state.jobStatus = action.payload
      if (
        action.payload.toLocaleLowerCase() === 'started' ||
        action.payload.toLocaleLowerCase() === 'stopped'
      ) {
        state.isProcessing = false
      }
    },
    // Reset the job details (optional: use on errors or once finished)
    resetJob: (state: Draft<IInitialState>) => {
      state.jobStatus = ''
      state.jobId = undefined
      state.isProcessing = false
      // // state.selectedServer = initialState.selectedServer
    },
  },
})

export const { startJob, updateJobStatus, resetJob } =
  serverStatusSlice.actions

export default serverStatusSlice.reducer
