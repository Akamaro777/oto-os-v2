/**
 * Anthropic API helpers (browser-direct). The API key lives in the TinyBase
 * settings store at runtime and is never committed. Model ids are the current
 * Claude 4.x line; bump here if newer ids ship.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export const MODELS = {
  /** Fast, cheap — meal macro extraction, event capture. */
  haiku: 'claude-haiku-4-5-20251001',
  /** Mentor chat — strong reasoning. */
  sonnet: 'claude-sonnet-4-6',
} as const

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface MessagesRequest {
  model: string
  maxTokens?: number
  system?: string
  messages: AnthropicMessage[]
  signal?: AbortSignal
}

export class AnthropicError extends Error {}

/** Low-level call to the Messages API; returns the concatenated text output. */
export async function callMessages(
  apiKey: string,
  { model, maxTokens = 1024, system, messages, signal }: MessagesRequest,
): Promise<string> {
  if (!apiKey) throw new AnthropicError('No API key set. Add it in Settings.')

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
    signal,
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new AnthropicError(`Anthropic ${res.status}: ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  return (data.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim()
}

export interface ExtractedMeal {
  name: string
  cal: number
  prot: number
}

const MEAL_SYSTEM = `You are a nutrition macro estimator. The user describes food they ate.
Return ONLY a JSON array of items, no prose, no markdown fences. Each item:
{"name": string, "cal": number (kcal), "prot": number (grams protein)}.
Split distinct dishes into separate items. Estimate realistic values for the described portions.`

/** Extract meal items with estimated calories/protein from free text. */
export async function extractMeals(apiKey: string, text: string): Promise<ExtractedMeal[]> {
  const raw = await callMessages(apiKey, {
    model: MODELS.haiku,
    maxTokens: 1024,
    system: MEAL_SYSTEM,
    messages: [{ role: 'user', content: text }],
  })
  return parseMealJson(raw)
}

/** Tolerant JSON parse: strips fences and pulls the first array found. */
export function parseMealJson(raw: string): ExtractedMeal[] {
  let s = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim()
  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start !== -1 && end !== -1) s = s.slice(start, end + 1)
  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    throw new AnthropicError('Could not parse the AI response.')
  }
  if (!Array.isArray(parsed)) throw new AnthropicError('AI response was not a list.')
  return parsed
    .map((item): ExtractedMeal | null => {
      if (typeof item !== 'object' || item == null) return null
      const o = item as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name : ''
      if (!name) return null
      return { name, cal: Math.round(Number(o.cal) || 0), prot: Math.round(Number(o.prot) || 0) }
    })
    .filter((m): m is ExtractedMeal => m != null)
}
