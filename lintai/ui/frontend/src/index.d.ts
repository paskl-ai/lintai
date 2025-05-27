interface ApiError {
  code?: number
  message?: string
  details?: ApiErrorDetails[]
}

interface ApiResponse<T> {
  files: any
  base64(base64: any, file_name: any): unknown
  file_name(base64: any, file_name: any): unknown
  results: T
  message: number
  notification: number
  total: number
  page: number
  pages: number
}
