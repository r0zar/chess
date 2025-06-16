"use client"

import { useState, useEffect } from "react"
import { formatDistanceToNow, isValid, parseISO, fromUnixTime } from "date-fns"

interface RelativeTimeDisplayProps {
  dateString: string | number | null // Can be ISO string or Unix timestamp (ms or s)
  fallbackText?: string
  className?: string
}

export default function RelativeTimeDisplay({ dateString, fallbackText = "N/A", className }: RelativeTimeDisplayProps) {
  const [relativeTime, setRelativeTime] = useState<string>(fallbackText)

  useEffect(() => {
    if (dateString === null || dateString === undefined) {
      setRelativeTime(fallbackText)
      return
    }

    let date: Date | null = null

    if (typeof dateString === "number") {
      // Check if it's seconds or milliseconds. Timestamps from Date.now() are ms.
      // If it's a very small number, assume seconds.
      date = dateString > 100000000000 ? new Date(dateString) : fromUnixTime(dateString)
    } else if (typeof dateString === "string") {
      date = parseISO(dateString)
    }

    if (date && isValid(date)) {
      setRelativeTime(formatDistanceToNow(date, { addSuffix: true }))
    } else {
      setRelativeTime("Invalid date")
    }
  }, [dateString, fallbackText])

  return <span className={className}>{relativeTime}</span>
}
