import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface ConfigState {
  depth: number
  logLevel: string
}

const initialState: ConfigState = {
  depth: 1,
  logLevel: 'info',
}

const configSlice = createSlice({
  name: 'config',
  initialState,
  reducers: {
    setDepth(state, action: PayloadAction<number>) {
      state.depth = action.payload
    },
    setLogLevel(state, action: PayloadAction<string>) {
      state.logLevel = action.payload
    },
  },
})

export const { setDepth, setLogLevel } = configSlice.actions
export default configSlice.reducer
