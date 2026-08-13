import { useState, useRef, useEffect } from 'react'
import { Send, Sparkles, Trash2, Loader2, Settings2 } from 'lucide-react'
import { Screen } from '@/components/Screen'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useChatMessages, addChatMessage, clearChat } from '@/store/chat'
import { getSetting } from '@/store/settings'
import { callMessages, MODELS, AnthropicError, type AnthropicMessage } from '@/lib/anthropic'
import { buildSystemPrompt, QUICK_PROMPTS } from '@/lib/mentorPrompt'
import { SettingsSheet } from '@/features/settings/SettingsSheet'
import { toast } from 'sonner'

export function MentorScreen() {
  const messages = useChatMessages()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const key = getSetting('apiKey')
    if (!key) {
      toast.error('Add your Anthropic API key in Settings first')
      setSettingsOpen(true)
      return
    }
    setInput('')
    addChatMessage('user', content)
    setBusy(true)
    try {
      // Window the replayed history (cost grows per message otherwise) and
      // skip error bubbles — they'd replay as things the mentor "said".
      const history: AnthropicMessage[] = [
        ...messages
          .filter((m) => !m.content.startsWith('⚠'))
          .slice(-30)
          .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        { role: 'user', content },
      ]
      const reply = await callMessages(key, {
        model: MODELS.sonnet,
        maxTokens: 1024,
        system: buildSystemPrompt(),
        messages: history,
      })
      addChatMessage('assistant', reply)
    } catch (err) {
      const msg = err instanceof AnthropicError ? err.message : 'Request failed'
      toast.error(msg)
      addChatMessage('assistant', `⚠ ${msg}`)
    } finally {
      setBusy(false)
    }
  }

  const empty = messages.length === 0

  return (
    <Screen
      title="Mentor"
      subtitle="direct, data-grounded coaching"
      action={
        <div className="flex gap-1">
          {!empty && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                // One mis-tap next to the Settings icon must not wipe months
                // of coaching history.
                if (window.confirm('Clear the whole mentor conversation?')) clearChat()
              }}
              aria-label="Clear chat"
            >
              <Trash2 className="size-5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings2 className="size-5" />
          </Button>
        </div>
      }
    >
      <div className="flex min-h-[calc(100dvh-14rem)] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-4">
          {empty ? (
            <div className="space-y-4 py-6">
              <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                <Sparkles className="size-8" style={{ color: '#c9f158' }} />
                <p className="max-w-[16rem] text-sm">
                  Your mentor sees all your logged data. Ask, or start with one of these:
                </p>
              </div>
              <div className="space-y-2">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => send(q.text)}
                    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-sm transition-colors hover:border-muted-foreground/30"
                  >
                    <span>{q.emoji}</span>
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm',
                    m.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-secondary text-foreground',
                  )}
                >
                  {m.content}
                </div>
              </div>
            ))
          )}
          {busy && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-secondary px-3.5 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> thinking…
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex items-end gap-2 border-t border-border bg-background/90 pt-3 backdrop-blur">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask your mentor…"
            rows={1}
            className="max-h-32 min-h-10 flex-1 resize-none"
          />
          <Button
            size="icon"
            className="shrink-0"
            onClick={() => send(input)}
            disabled={busy || !input.trim()}
            aria-label="Send"
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>

      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
    </Screen>
  )
}
