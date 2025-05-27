const ErrorPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-6">
      <h1 className="text-7xl font-bold text-gray-800 sm:text-9xl">500</h1>
      <h2 className="mt-4 text-2xl font-semibold text-gray-700 sm:text-4xl">
        Something went wrong
      </h2>
      <p className="mt-3 text-gray-500 sm:text-lg">
        We apologize for the inconvenience. Please try again later.
      </p>
      <div className="mt-6 flex space-x-4">
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Reload Page
        </button>
        <a
          href="/"
          className="rounded-lg border border-gray-700 px-6 py-3 text-sm font-medium text-gray-800 transition hover:bg-gray-200"
        >
          Go to Homepage
        </a>
      </div>
    </div>
  )
}

export default ErrorPage
