import { store } from '@/store/store'
import { T } from '@/store/schema'
import { todayISO, addDaysISO } from './dates'

type Row = Record<string, string | number | boolean | undefined>

function num(v: unknown): number {
  return Number(v ?? 0)
}

function last7(anchor: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysISO(anchor, -(6 - i)))
}

/**
 * Build the Mentor system prompt from the current store state. Mirrors v1's
 * accountability-partner brief, grounded in Oto's logged data.
 */
export function buildSystemPrompt(): string {
  const td = todayISO()
  const p = (k: string) => store.getValue(`profile.${k}`)

  const body = (store.getRow(T.body, td) ?? {}) as Row
  const social = (store.getRow(T.social, td) ?? {}) as Row
  const money = (store.getRow(T.money, td) ?? {}) as Row
  const cv = (store.getRow(T.cv, td) ?? {}) as Row

  // 7-day stats
  const week = last7(td)
  const moneyTable = store.getTable(T.money) as Record<string, Row>
  const cvTable = store.getTable(T.cv) as Record<string, Row>
  const socialTable = store.getTable(T.social) as Record<string, Row>
  const bizHrsWeek = week.reduce((x, d) => x + num(moneyTable[d]?.hours), 0)
  const callsWeek = week.reduce((x, d) => x + num(cvTable[d]?.calls), 0)
  const studyHrsWeek = week.reduce((x, d) => x + num(cvTable[d]?.studyHours), 0)
  const probsWeek = week.reduce((x, d) => x + num(cvTable[d]?.problems), 0)
  const correctWeek = week.reduce((x, d) => x + num(cvTable[d]?.correct), 0)
  const accWeek = probsWeek > 0 ? Math.round((correctWeek / probsWeek) * 100) : null
  const ratings = week.map((d) => socialTable[d]?.rating).filter((r) => r != null) as number[]
  const avgRating = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null

  // Portfolio
  const portfolio = Object.values(store.getTable(T.portfolio) as Record<string, Row>).sort(
    (a, b) => num(a.ts) - num(b.ts),
  )
  const latestP = portfolio[portfolio.length - 1]
  const firstP = portfolio[0]
  let portStr = 'no entries'
  if (latestP) {
    portStr = `€${num(latestP.value).toFixed(0)}`
    if (firstP && firstP !== latestP) {
      const change = num(latestP.value) - num(firstP.value)
      const pct = ((change / num(firstP.value)) * 100).toFixed(1)
      portStr += ` (${change >= 0 ? '+' : ''}${pct}% since ${firstP.date})`
    }
  }

  // CV milestones + events + ideas
  const goals = Object.values(store.getTable(T.cvGoals) as Record<string, Row>)
    .filter((g) => !g.done)
    .slice(0, 8)
  const events = Object.values(store.getTable(T.events) as Record<string, Row>)
    .filter((e) => {
      const dd = String(e.date ?? '')
      return dd >= td && dd <= addDaysISO(td, 14)
    })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(0, 10)
  const eventStr = events.length
    ? events.map((e) => `${e.date}${e.time ? ' ' + e.time : ''} ${e.title} [${e.category ?? ''}]`).join(' | ')
    : 'no scheduled events'
  const ideas = Object.values(store.getTable(T.ideas) as Record<string, Row>).slice(0, 5)

  return `You are Oto's personal mentor and accountability partner. You know his full operating system and goals.

CORE GOALS (5-year, 2026-2031):
1. BODY: 78-80kg lean, strong endurance, looksmaxing
2. SOCIAL: high social skills, network, active dating life
3. MONEY: own business/agency EUR 4k+/mo to escape office work + portfolio growth
4. CV: HEC Paris MFin admission + standout internship stack

CURRENT MILESTONES (Aug-Dec 2026) - these are what he is actively hitting NOW:
- GMAT: ${p('gmatTargetScore')} score
- MONEY: EUR ${p('mrrTarget')}/month by December - currently EUR ${p('mrr')}/mo
- TRAVEL: visit ${p('countriesTarget')} countries - ${p('countriesVisited')} so far
- SOCIAL: ${p('bodiesTarget')} bodies - ${p('bodiesCount')} so far

BIG DAILY RULES (non-negotiable, hold him to these):
- First 3h of the day: phone-free GMAT deep work
- Out of the house by 12:00
- ${p('callsDailyTarget')} cold calls a day
- Every Sunday: a run

CONTEXT:
- M&A/finance career is INSTRUMENTAL - exists only to get into HEC MFin. Long-term plan is to leave finance for own business.
- Currently: Tilburg IBA honors, exchange at NUS Aug 2026-Jan 2027, PwC Latvia internship June-Aug 2026
- 6-school MFin application strategy: HEC (P1), ESCP (P2), Bocconi (P3), ESSEC, LBS, LSE - Sep 2027 intake
- GMAT prep ongoing, target 720+ at Attempt #2 (Jan 2027)

PROFILE:
- Name: ${p('name')} | Current weight: ${p('weight')}kg -> target ${p('targetWeight')}kg
- Daily targets: ${p('bizTarget')}h business, ${p('studyTarget')}h study

TODAY (${td}):
- Body: ${body.weight ? body.weight + 'kg' : 'no weight'}, sleep ${body.sleep ? body.sleep + 'h' : '-'}, gym ${body.gym ? 'yes' : 'no'}
- Social: rating ${social.rating ?? '-'}/10, ${num(social.approaches)} approaches, ${num(social.compliments)} compliments, ${num(social.connections)} connections
- Money: ${num(cv.calls)} cold calls${num(money.hours) > 0 ? `, ${num(money.hours).toFixed(1)}h on business` : ''}
- CV: ${num(cv.studyHours).toFixed(1)}h study, ${num(cv.problems)} GMAT problems${num(cv.problems) > 0 ? ', ' + Math.round((num(cv.correct) / num(cv.problems)) * 100) + '% acc' : ''}

LAST 7 DAYS:
- Cold calls: ${callsWeek} (target ${(num(p('callsDailyTarget')) * 7).toFixed(0)})${bizHrsWeek > 0 ? `\n- Business hours: ${bizHrsWeek.toFixed(1)}h` : ''}
- Study hours: ${studyHrsWeek.toFixed(1)}h
- GMAT: ${probsWeek} problems${accWeek != null ? ', ' + accWeek + '% acc' : ''}
- Avg social rating: ${avgRating ?? 'no data'}/10

PORTFOLIO: ${portStr}

ACTIVE CV MILESTONES: ${goals.map((g) => `${g.title}${g.deadline ? ' (by ' + g.deadline + ')' : ''}`).join(' | ') || 'none set'}
UPCOMING EVENTS (14d): ${eventStr}
IDEAS BANK: ${ideas.map((i) => i.title).join(' | ') || 'empty - needs filling'}

YOUR ROLE:
- Be a direct, no-bullshit mentor. Push back when his plan is weak or he's avoiding something.
- Ground every recommendation in his actual logged data.
- Reference HEC application strength, not long-term M&A career building.
- Keep responses concise (3-6 sentences usually). Use specifics, not vague advice.
- Use hyphens not em-dashes.`
}

export const QUICK_PROMPTS = [
  { emoji: '📊', label: '7-day honest review', text: 'Review my last 7 days across all 4 pillars and tell me where I am slipping. Be direct.' },
  { emoji: '🎯', label: 'Top 3 priorities today', text: 'Based on my current data, what are the 3 highest-leverage things I should do today?' },
  { emoji: '⚡', label: 'Push back on me', text: "Push back on my plan. What am I rationalizing or avoiding right now?" },
  { emoji: '💡', label: 'Business idea sprint', text: 'Help me brainstorm business ideas based on my skills, network, and what I have been logging.' },
  { emoji: '📈', label: 'GMAT trajectory', text: 'What is my GMAT trajectory? At current pace, when do I hit 720+?' },
] as const
