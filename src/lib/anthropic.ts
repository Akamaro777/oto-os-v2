/**
 * Anthropic API helpers (browser-direct). The API key lives in the TinyBase
 * settings store at runtime and is never committed. Model ids are the current
 * Claude 4.x line; bump here if newer ids ship.
 */

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

export const MODELS = {
  /** Fast, cheap — voice capture extraction. */
  haiku: 'claude-haiku-4-5-20251001',
  /** Mentor chat — strong reasoning. */
  sonnet: 'claude-sonnet-4-6',
} as const

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

/** Wrap a JPEG data-URL as an image content block for vision requests. */
export function imageBlock(dataUrl: string): ContentBlock {
  const [head, data] = dataUrl.split(',', 2)
  const mediaType = head.match(/^data:([^;]+)/)?.[1] ?? 'image/jpeg'
  return { type: 'image', source: { type: 'base64', media_type: mediaType, data } }
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
