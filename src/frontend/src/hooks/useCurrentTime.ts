import { useEffect, useState } from 'react'

// Re-evaluate visible deadlines without relying on incidental renders or mutating domain data.
export function useCurrentTime() {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}
