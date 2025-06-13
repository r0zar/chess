export default function LoadingGame() {
  // This skeleton will be rendered by Next.js Suspense on the server
  // while the `GamePage` component fetches its initial data.
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
      <h1 className="text-3xl font-bold mb-2 sm:mb-4 text-gray-800 dark:text-gray-100">Chess Game</h1>
      <div className="mb-2 sm:mb-4 p-3 rounded-lg shadow bg-white dark:bg-gray-800 w-full max-w-md text-center animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mx-auto"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mx-auto mt-2"></div>
      </div>

      {/* Skeleton for the board */}
      <div
        style={{ aspectRatio: "1 / 1" }}
        className="w-full max-w-[720px] min-w-[280px] bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md shadow-lg"
      ></div>

      <div className="mt-6 h-10 w-40 bg-gray-300 dark:bg-gray-600 animate-pulse rounded-md"></div>
    </div>
  )
}
