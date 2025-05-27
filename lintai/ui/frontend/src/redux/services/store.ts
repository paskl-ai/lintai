import { configureStore } from '@reduxjs/toolkit'
import { setupListeners } from '@reduxjs/toolkit/query'
import type { TypedUseSelectorHook } from 'react-redux'
import { useDispatch, useSelector } from 'react-redux'
import { combineReducers } from 'redux'
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from 'redux-persist'
import storage from 'redux-persist/lib/storage'

import AuthReducer from './Auth/auth.slice'
import UserReducer from './User/user.slice'
import ServerStatusReducer from './ServerStatus/server.status.slice'

const persistConfig = {
  key: 'root',
  storage,
}

const reducers = combineReducers({
  // search: SearchReducer,
  auth: AuthReducer,
  // error:ErrorReducer,
  serverStatus: ServerStatusReducer,

  user: UserReducer,
  // general:GeneralReducer,
  // job:JobReducer,
  // imageSelect:ImageReducer,
  // animation:AnimationReducer
})

const persistedReducer = persistReducer(persistConfig, reducers)

const store = configureStore({
  devTools: process.env.NODE_ENV === 'development',
  reducer: persistedReducer,

  middleware: (getDefaultMiddleware) => {
    const middlewares = getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    })
    return middlewares
  },
})
const persistor = persistStore(store)

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>
// Inferred type: {posts: PostsState, comments: CommentsState, users: UsersState}
export type AppDispatch = typeof store.dispatch
export const useAppDispatch: () => AppDispatch = useDispatch
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector

// setupListeners(store.dispatch)
export { store, persistor }
