import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Provider } from 'react-redux'
import { BrowserRouter } from 'react-router'

import './features/Counter/index.module.css'

import ErrorPage from './pages/error/error.page'
import { store } from './redux/services/store'

import RootRouter from './Router/RootRouter'
import { ToastContainer } from 'react-toastify'
import LintToastContainer from './components/Toast/toast.component'

const queryClientConfig = {
  defaultOptions: {
    queries: {
      retry: 1,
      // staleTime: 1000 * 30,// 30seconds
      // cacheTime: 1000 * 30, //30 seconds
      // refetchOnMount: "always",
      // refetchOnWindowFocus: "always",
      // refetchOnReconnect: "always",
      // refetchInterval: 1000 * 30, //30 seconds
      refetchIntervalInBackground: false,
      suspense: false,
    },
    mutations: {
      retry: 0,
    },
  },
}

const queryClient = new QueryClient(queryClientConfig)

const App: React.FC = () => {
  return (
    <React.StrictMode>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary fallback={<ErrorPage />}>
          <LintToastContainer />
            <BrowserRouter>
              <RootRouter />
            </BrowserRouter>
          </ErrorBoundary>
        </QueryClientProvider>
      </Provider>
    </React.StrictMode>
  )
}

export default App
