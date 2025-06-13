"use client"

import dynamic from "next/dynamic"
import type { ChessboardProps } from "react-chessboard"

// Dynamically import react-chessboard to avoid SSR issues, as it's a client-side library.
const ChessboardComponent = dynamic(() => import("react-chessboard").then((mod) => mod.Chessboard), {
  ssr: false,
  // Provide a loading skeleton that matches the board's aspect ratio
  loading: () => (
    <div
      style={{ aspectRatio: "1 / 1" }}
      className="w-full bg-gray-200 dark:bg-gray-700 animate-pulse rounded-md shadow-lg"
    ></div>
  ),
})

/**
 * A shared wrapper for the react-chessboard component.
 * This centralizes the component's usage and dynamic import logic.
 */
const ChessBoard = (props: ChessboardProps) => {
  return <ChessboardComponent {...props} />
}

export default ChessBoard
