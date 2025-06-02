import type { AxiosRequestConfig, AxiosError, AxiosInstance } from 'axios'
import axios from 'axios'
import HttpStatus from 'http-status-codes'
import { toast } from 'react-toastify'

import { userLogout } from '../redux/services/Auth/auth.slice'
import { store } from '../redux/services/store'

export const baseUrl = import.meta.env.VITE_API_BASE_URL
const RETRY_COUNT_LIMIT = 3
let noResponseHeaderCount = 0
const maxNoResponseHeaderCount = 3

interface CustomConfig extends AxiosRequestConfig {
  __isRetryRequest?: boolean
  _retry?: boolean
  retryCount: number
}

const api: AxiosInstance = axios.create({
  
})

// Request interceptor
api.interceptors.request.use(async (config) => {
  const { auth } = store.getState()

  if (auth.token) {
    config.headers.Authorization = `Bearer ${auth.token}`
  }

  return config
})
// Response interceptor
api.interceptors.response?.use(
  ({ data, ...all }) => {
    //     const dispatch= store.dispatch
    // // console.log(data,'metadata')
    // dispatch(setUnreadMessage({unreadMessage:data?.message,unreadNotification:data?.notification}))

    return { data, ...all }
  },
  async (error) => {
    const err = error as AxiosError<ApiError>
    const dispatch = store.dispatch

    const config = err.config as CustomConfig
    // Check if the error code is 401 and message is Unauthorized
    if (err?.response?.data?.code !== 400) {
      noResponseHeaderCount = 0
    } else {
      noResponseHeaderCount += 1
    }

    if (noResponseHeaderCount >= maxNoResponseHeaderCount) {
      // dispatch(setError({
      //   errorMessage: err?.response?.data.message,
      //   isSnackBarVisible: true,
      //   type: "error",
      // }))
      // dispatch(userLogout());
    }
    if (err?.response?.data?.message !== 'Bad Request') {
      toast.error(err?.response?.data?.message)
    }

    if (err?.response?.data.code === 401) {
      dispatch(userLogout())
    }

    if (
      err?.response?.data.code === 403 &&
      err?.response?.data.message === 'Account setup required'
    ) {
      //any addition code redirection
    }
    if (err?.response?.data.code === 426) {
      //version control methods can be done here
    }
    if (err?.response?.data.code === 503) {
      // dispatch(setError({
      //   errorMessage: err?.response?.data.message,
      //   isSnackBarVisible: true,
      //   type: "error",
      // }))
    }

    if (
      Number(err?.response?.data?.code) === HttpStatus.UNAUTHORIZED &&
      err?.response?.data?.message ===
        HttpStatus.getStatusText(HttpStatus.UNAUTHORIZED) &&
      !config.__isRetryRequest
    ) {
      // If retries exceed the limit, logout user
      if (config?.retryCount >= RETRY_COUNT_LIMIT) {
        toast.error('Session Expired.')
        // store.dispatch(userLogout())
        return Promise.reject(error)
      }

      // Retry the request
      config._retry = true
      config.retryCount = (config.retryCount || 0) + 1

      return api(config)
    }

    // Handle other errors without logging a warning

    return Promise.reject(error)
  },
)

export default api
