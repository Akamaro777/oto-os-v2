import { useCallback, useEffect, useRef, useState } from 'react'

/* Minimal Web Speech API typings (not in lib.dom for all TS configs) */
interface SpeechResultAlternative {
  transcript: string
}
interface SpeechResult {
  isFinal: boolean
  0: SpeechResultAlternative
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: { length: number; [i: number]: SpeechResult }
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
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

/** Push-to-talk speech recognition. Accumulates finalised text across pauses. */
export function useSpeech(lang = 'en-US'): SpeechState {
  const [supported] = useState(() => getRecognitionCtor() != null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
    setInterim('')
  }, [])

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return
    setError(null)
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true
    rec.onresult = (e) => {
      let interimText = ''
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      if (finalText) setTranscript((prev) => (prev ? prev + ' ' : '') + finalText.trim())
      setInterim(interimText)
    }
    rec.onerror = (e) => {
      if (e.error === 'not-allowed') setError('Microphone permission denied')
      else if (e.error && e.error !== 'aborted' && e.error !== 'no-speech')
        setError(`Speech error: ${e.error}`)
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setError('Could not start the microphone')
    }
  }, [lang])

  const reset = useCallback(() => {
    setTranscript('')
    setInterim('')
    setError(null)
  }, [])

  useEffect(() => () => recRef.current?.abort(), [])

  return { supported, listening, transcript, interim, error, start, stop, reset }
}
