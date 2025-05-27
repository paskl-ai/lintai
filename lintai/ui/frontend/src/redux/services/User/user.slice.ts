import type { Draft, PayloadAction } from '@reduxjs/toolkit'
import { createSlice } from '@reduxjs/toolkit'

export interface User {
  email: string
}
interface IInitialState {
  user: User

}

const initialState: IInitialState = {
  user: {
    email: '',
  },

}

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (
      state: Draft<IInitialState>,
      action: PayloadAction<Pick<IInitialState, 'user'>>,
    ) => {
      state.user = action.payload?.user
    },
    removeUser: (state: Draft<IInitialState>) => {
      state.user = initialState.user
    },

  },
})

export const { setUser, removeUser } =
  userSlice.actions

export default userSlice.reducer
