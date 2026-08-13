/**
 * Anthropic API helpers (browser-direct). The API key lives in the TinyBase
 * settings store at runtime and is never committed. Default model ids live
 * here; Settings → model overrides can bump them without a redeploy.
 */

import { getSetting } from '@/store/settings'

const API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

const DEFAULT_MODELS = {
  /** Fast, cheap — voice capture extraction. */
  haiku: 'claude-haiku-4-5-20251001',
  /** Mentor chat + vision extraction — supports structured outputs. */
  sonnet: 'claude-sonnet-5',
} as const

/** Resolve a model id, honouring the Settings override when set. */
export function resolveModel(tier: 'haiku' | 'sonnet'): string {
  const override = getSetting(tier === 'haiku' ? 'modelHaiku' : 'modelSonnet').trim()
  return override || DEFAULT_MODELS[tier]
}

/** Back-compat named ids (resolved at call time via MODELS.haiku / MODELS.sonnet). */
export const MODELS = {
  get haiku() {
    return resolveModel('haiku')
  },
  get sonnet() {
    return resolveModel('sonnet')
  },
}

export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

/** A user-defined tool the model may call (JSON Schema input). */
export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
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
  /** Throw when the reply was cut off by max_tokens (JSON extraction callers —
   * a truncated JSON always fails downstream with a misleading parse error). */
  failOnMaxTokens?: boolean
  /** Constrain the response to this JSON Schema (structured outputs) — the
   * first text block is then guaranteed-valid JSON. Sonnet 5 / Haiku 4.5. */
  jsonSchema?: Record<string, unknown>
  /** Turn thinking off (Sonnet 5 thinks by default; extraction doesn't need it). */
  disableThinking?: boolean
  tools?: ToolDef[]
}

export class AnthropicError extends Error {}

interface RawResponse {
  content?: (
    | { type: 'text'; text?: string }
    | { type: 'thinking'; thinking?: string }
    | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  )[]
  stop_reason?: string
}

async function postMessages(apiKey: string, body: Record<string, unknown>, signal?: AbortSignal) {
  let res: Response
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      // A stalled mobile request must never pin the UI on "thinking…" forever.
      signal: signal ?? AbortSignal.timeout(90_000),
    })
  } catch (e) {
    if (e instanceof DOMException && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
      throw new AnthropicError('Request timed out — check your connection and retry.')
    }
    throw new AnthropicError(e instanceof Error ? e.message : 'Network error')
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new AnthropicError(`Anthropic ${res.status}: ${detail.slice(0, 200)}`)
  }
  return (await res.json()) as RawResponse
}

function buildBody({
  model,
  maxTokens = 1024,
  system,
  messages,
  jsonSchema,
  disableThinking,
  tools,
}: MessagesRequest): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    max_tokens: maxTokens,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  }
  if (system) body.system = system
  if (jsonSchema) body.output_config = { format: { type: 'json_schema', schema: jsonSchema } }
  if (disableThinking) body.thinking = { type: 'disabled' }
  if (tools?.length) body.tools = tools
  return body
}

function textOf(data: RawResponse): string {
  return (data.content ?? [])
    .filter((b): b is { type: 'text'; text?: string } => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim()
}

/** Low-level call to the Messages API; returns the concatenated text output. */
export async function callMessages(apiKey: string, req: MessagesRequest): Promise<string> {
  if (!apiKey) throw new AnthropicError('No API key set. Add it in Settings.')

  const data = await postMessages(apiKey, buildBody(req), req.signal)

  if (data.stop_reason === 'refusal') {
    throw new AnthropicError('Claude declined this request — try rephrasing.')
  }
  const text = textOf(data)
  if (data.stop_reason === 'max_tokens' && req.failOnMaxTokens) {
    throw new AnthropicError('The reply hit the length limit — try a shorter input.')
  }
  if (!text) {
    throw new AnthropicError('The model returned no text — try rephrasing.')
  }
  // A visibly truncated chat reply is better than a silently truncated one.
  return data.stop_reason === 'max_tokens' ? `${text} …` : text
}

/** What a tool did, surfaced to the UI as a small activity line. */
export interface ToolActivity {
  name: string
  summary: string
}

/**
 * Tool-use loop: let the model call tools, execute them via `executors`, feed
 * results back, and repeat until it answers in plain text. Returns the final
 * text plus a log of what each tool did. Executors should THROW on bad input —
 * the error text is returned to the model as an is_error tool result.
 */
export async function callWithTools(
  apiKey: string,
  req: MessagesRequest & { tools: ToolDef[] },
  executors: Record<string, (input: Record<string, unknown>) => string>,
  maxIterations = 6,
): Promise<{ text: string; activity: ToolActivity[] }> {
  if (!apiKey) throw new AnthropicError('No API key set. Add it in Settings.')

  const messages: AnthropicMessage[] = [...req.messages]
  const activity: ToolActivity[] = []

  for (let i = 0; i < maxIterations; i++) {
    const data = await postMessages(apiKey, buildBody({ ...req, messages }), req.signal)
    if (data.stop_reason === 'refusal') {
      throw new AnthropicError('Claude declined this request — try rephrasing.')
    }

    const toolUses = (data.content ?? []).filter(
      (b): b is { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } =>
        b.type === 'tool_use',
    )
    if (data.stop_reason !== 'tool_use' || toolUses.length === 0) {
      const text = textOf(data)
      if (!text) throw new AnthropicError('The model returned no text — try rephrasing.')
      return { text: data.stop_reason === 'max_tokens' ? `${text} …` : text, activity }
    }

    // Echo the assistant turn VERBATIM (thinking blocks included — the API
    // validates them on replay), then answer every tool call in ONE user turn.
    messages.push({ role: 'assistant', content: (data.content ?? []) as ContentBlock[] })
    const results: ContentBlock[] = []
    for (const tu of toolUses) {
      try {
        const summary = executors[tu.name]
          ? executors[tu.name](tu.input)
          : (() => {
              throw new Error(`Unknown tool: ${tu.name}`)
            })()
        activity.push({ name: tu.name, summary })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: summary })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Tool failed'
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: msg, is_error: true })
      }
    }
    messages.push({ role: 'user', content: results })
  }

  throw new AnthropicError('Too many tool steps — try a simpler request.')
}
