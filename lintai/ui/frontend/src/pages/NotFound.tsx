const NotFound: React.FC = () => {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-6">
      <div className="text-center">
        <h1 className="text-7xl font-bold text-gray-800 sm:text-9xl">404</h1>
        <h2 className="mt-4 text-2xl font-semibold text-gray-700 sm:text-4xl">
          Page Not Found
        </h2>
        <p className="mt-3 text-gray-500 sm:text-lg">
          The page you are looking for does not exist.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="rounded-lg bg-black px-6 py-3 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            Go Home
          </a>
        </div>
      </div>
    </main>
  )
}

export default NotFound
