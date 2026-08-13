/**
 * Import handles from Instagram's own "Download Your Information" export.
 *
 * Instagram has no API that exposes your followers/following, and scraping the
 * site with your login gets accounts banned. The supported path is the data
 * export Instagram gives you about yourself: connections/followers_and_following/
 * {followers_1,following}.json. Both files nest the same shape, so we just walk
 * the JSON and collect every string_list_data entry.
 */
import { store } from '@/store/store'
import { T } from '@/store/schema'
import { createContact } from '@/store/people'
import { toISO } from './dates'

export interface IgAccount {
  handle: string
  /** Unix seconds when the follow happened, 0 if absent. */
  timestamp: number
}

/** Walk any Instagram export shape and pull out {value, timestamp} pairs. */
export function parseInstagramExport(raw: unknown): IgAccount[] {
  const out = new Map<string, number>()
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!node || typeof node !== 'object') return
    const obj = node as Record<string, unknown>
    const list = obj.string_list_data
    if (Array.isArray(list)) {
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue
        const e = entry as Record<string, unknown>
        const handle = String(e.value ?? '').trim().replace(/^@/, '')
        if (!handle) continue
        const ts = Number(e.timestamp ?? 0) || 0
        out.set(handle, Math.max(out.get(handle) ?? 0, ts))
      }
    }
    for (const v of Object.values(obj)) visit(v)
  }
  visit(raw)
  return [...out.entries()]
    .map(([handle, timestamp]) => ({ handle, timestamp }))
    .sort((a, b) => b.timestamp - a.timestamp)
}

export interface IgImportResult {
  created: number
  linked: number
  skipped: number
}

/**
 * Create contacts for the most recent `limit` handles that aren't already in
 * People. Handles already on a contact are left alone (they're linked).
 */
export function importInstagramAccounts(accounts: IgAccount[], limit: number): IgImportResult {
  const known = new Set(
    Object.values(store.getTable(T.contacts))
      .map((c) => String(c.instagram ?? '').trim().toLowerCase())
      .filter(Boolean),
  )
  let created = 0
  let linked = 0
  let skipped = 0
  store.transaction(() => {
    for (const acc of accounts) {
      // Known first — an already-linked handle past the limit is "linked",
      // not "older skipped", or the toast miscounts.
      if (known.has(acc.handle.toLowerCase())) {
        linked++
        continue
      }
      if (created >= limit) {
        skipped++
        continue
      }
      known.add(acc.handle.toLowerCase())
      createContact({
        name: acc.handle,
        instagram: acc.handle,
        met: 'Instagram',
        category: 'other',
        lastContact: acc.timestamp ? toISO(new Date(acc.timestamp * 1000)) : undefined,
      })
      created++
    }
  })
  return { created, linked, skipped }
}
