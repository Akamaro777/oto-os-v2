import { useEffect, useRef, useState } from 'react'

interface Tilt {
  /** Degrees to rotate around X (from device pitch). */
  rx: number
  /** Degrees to rotate around Y (from device roll). */
  ry: number
}

interface OrientationEventCtor {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

/**
 * iOS requires a user gesture before orientation events flow.
 * Call from any pointer handler; silently no-ops elsewhere.
 */
export async function requestTiltPermission(): Promise<void> {
  const ctor = window.DeviceOrientationEvent as unknown as OrientationEventCtor | undefined
  if (ctor?.requestPermission) {
    try {
      await ctor.requestPermission()
    } catch {
      /* denied or unavailable — parallax just stays off */
    }
  }
}

/** Subtle device-tilt parallax (±maxDeg). Returns zeros when unsupported/reduced-motion. */
export function useDeviceTilt(maxDeg = 3): Tilt {
  const [tilt, setTilt] = useState<Tilt>({ rx: 0, ry: 0 })
  const raf = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('DeviceOrientationEvent' in window)) return

    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      // beta ~45° is a natural holding angle; measure deviation from it
      const rx = Math.max(-maxDeg, Math.min(maxDeg, (e.beta - 45) / 10))
      const ry = Math.max(-maxDeg, Math.min(maxDeg, e.gamma / 10))
      cancelAnimationFrame(raf.current)
      raf.current = requestAnimationFrame(() => setTilt({ rx: -rx, ry }))
    }
    window.addEventListener('deviceorientation', onOrient)
    return () => {
      window.removeEventListener('deviceorientation', onOrient)
      cancelAnimationFrame(raf.current)
    }
  }, [maxDeg])

  return tilt
}
