import { useState, useCallback } from 'react'
import { useValue } from 'tinybase/ui-react'
import { store } from './store'
import { getSetting } from './settings'
import { todayISO } from '@/lib/dates'
import { callMessages, MODELS, AnthropicError } from '@/lib/anthropic'
import { buildSystemPrompt } from '@/lib/mentorPrompt'

// Module-level guard so StrictMode double-mounts don't fire two API calls.
let inFlight = false

export interface Briefing {
  /** Today's cached briefing text, or '' when not generated yet. */
  text: string
  generating: boolean
  /** True when a key is present and today's briefing is missing. */
  stale: boolean
  generate: () => Promise<void>
}

/** AI morning briefing — generated once per day, cached in the store. */
export function useBriefing(): Briefing {
  const date = (useValue('app.briefingDate', store) as string | undefined) ?? ''
  const text = (useValue('app.briefingText', store) as string | undefined) ?? ''
  const [generating, setGenerating] = useState(false)

  const today = todayISO()
  const fresh = date === today && text.length > 0
  const hasKey = getSetting('apiKey').length > 0

  const generate = useCallback(async () => {
    if (inFlight) return
    const key = getSetting('apiKey')
    if (!key) throw new AnthropicError('Add your Anthropic API key in Settings first.')
    inFlight = true
    setGenerating(true)
    try {
      const reply = await callMessages(key, {
        model: MODELS.haiku,
        maxTokens: 300,
        system: buildSystemPrompt(),
        messages: [
          {
            role: 'user',
            content:
              'Write my morning briefing: 2-3 short sentences max. Lead with the sharpest observation from my data (pace vs goals, yesterday, streaks), then the single highest-leverage move for today. Direct, specific numbers, no greeting, no fluff, no markdown.',
          },
        ],
      })
      store.setValue('app.briefingDate', todayISO())
      store.setValue('app.briefingText', reply)
    } finally {
      inFlight = false
      setGenerating(false)
    }
  }, [])

  return { text: fresh ? text : '', generating, stale: hasKey && !fresh, generate }
}
