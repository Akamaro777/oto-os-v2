import { useCallback, useEffect, useRef, useState } from 'react'

/* Minimal Web Speech API typings (not in lib.dom for all TS configs) */
interface SpeechResultAlternative {
  transcript: string
  confidence?: number
}
interface SpeechResult {
  isFinal: boolean
  length: number
  [i: number]: SpeechResultAlternative
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [i: number]: SpeechResult }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error?: string }) => void) | null
  onend: (() => void) | null
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null
}

/** Best alternative by confidence (engines usually order them, but not always). */
function bestAlternative(res: SpeechResult): string {
  let best = res[0]
  for (let i = 1; i < res.length; i++) {
    const alt = res[i]
    if (alt && (alt.confidence ?? 0) > (best.confidence ?? 0)) best = alt
  }
  return best?.transcript ?? ''
}

export interface SpeechState {
  /** Device supports in-page speech recognition. When false the textarea + keyboard dictation is the path. */
  supported: boolean
  listening: boolean
  /** Finalised text so far. */
  transcript: string
  /** Live, not-yet-final words. */
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  reset: () => void
}

/**
 * Push-to-talk speech recognition. Accumulates finalised text across pauses.
 *
 * Mobile engines end a session after a short silence, which used to cut the
 * capture off mid-thought — so while the user hasn't tapped stop, a session
 * that ends on its own is transparently restarted and the transcript keeps
 * accumulating. Also picks the highest-confidence alternative per result and
 * drops the duplicated finals some Android builds emit.
 */
export function useSpeech(lang = 'en-US'): SpeechState {
  const [supported] = useState(() => getRecognitionCtor() != null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  /** True while the user wants the mic open — drives silent auto-restarts. */
  const keepAliveRef = useRef(false)
  const lastFinalRef = useRef('')
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stop = useCallback(() => {
    keepAliveRef.current = false
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    setError(null)
    keepAliveRef.current = true
    lastFinalRef.current = ''

    const spinUp = () => {
      const rec = new Ctor()
      rec.lang = lang
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 3
      rec.onresult = (e) => {
        let interimText = ''
        let finalText = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i]
          if (res.isFinal) {
            const chunk = bestAlternative(res).trim()
            // Some Android builds re-emit the previous final result — drop it.
            if (chunk && chunk !== lastFinalRef.current) {
              finalText += (finalText ? ' ' : '') + chunk
              lastFinalRef.current = chunk
            }
          } else {
            interimText += res[0]?.transcript ?? ''
          }
        }
        if (finalText) setTranscript((prev) => (prev ? prev + ' ' : '') + finalText)
        setInterim(interimText)
      }
      rec.onerror = (e) => {
        // no-speech / aborted are routine pauses; onend handles the restart.
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          keepAliveRef.current = false
          setError('Microphone permission denied')
          setListening(false)
        } else if (e.error === 'network') {
          keepAliveRef.current = false
          setError('Speech service unreachable — check your connection')
          setListening(false)
        }
      }
      rec.onend = () => {
        setInterim('')
        if (keepAliveRef.current) {
          // The engine gave up after a silence — reopen with a fresh session.
          restartTimerRef.current = setTimeout(() => {
            if (keepAliveRef.current) spinUp()
          }, 100)
        } else {
          setListening(false)
        }
      }
      recRef.current = rec
      try {
        rec.start()
        setListening(true)
      } catch {
        keepAliveRef.current = false
        setError('Could not start the microphone')
        setListening(false)
      }
    }

    spinUp()
  }, [lang])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
    lastFinalRef.current = ''
  }, [])

  useEffect(
    () => () => {
      keepAliveRef.current = false
      if (restartTimerRef.current) clearTimeout(restartTimerRef.current)
      recRef.current?.abort()
    },
    [],
  )

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
