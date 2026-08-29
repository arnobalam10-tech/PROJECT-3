import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Defaults to false (desktop) rather than undefined — the effect below
  // only subscribes to future changes, per react-hooks' "don't call
  // setState synchronously within an effect body" rule; it self-corrects
  // on mount if the real viewport is narrower, same as any other
  // client-only media-query hook.
  const [isMobile, setIsMobile] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    onChange()
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
