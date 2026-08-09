import { useEffect, useRef, useState } from 'react'
import { Upload, Download, RefreshCw } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSetting, setSetting } from '@/store/settings'
import { importV1 } from '@/lib/importV1'
import { exportBackup, mergeImport } from '@/lib/exportData'
import { listSnapshots, downloadSnapshot, type Snapshot } from '@/lib/backups'
import { parseInstagramExport, importInstagramAccounts } from '@/lib/instagramImport'
import { pull as syncPull } from '@/lib/sync'
import { pushSupported, isPushEnabled, enablePush, disablePush } from '@/lib/push'
import { toast } from 'sonner'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [apiKey, setApiKey] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [proxySecret, setProxySecret] = useState('')
  const [syncUrl, setSyncUrl] = useState('')
  const [syncSecret, setSyncSecret] = useState('')
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const seedRef = useRef<HTMLInputElement>(null)
  const igRef = useRef<HTMLInputElement>(null)
  const [igLimit, setIgLimit] = useState('25')

  async function handleInstagramImport(file: File) {
    try {
      const accounts = parseInstagramExport(JSON.parse(await file.text()))
      if (!accounts.length) {
        toast.error('No accounts found — pick followers_1.json or following.json')
        return
      }
      const limit = Math.max(1, Number(igLimit) || 25)
      const r = importInstagramAccounts(accounts, limit)
      toast.success(
        `${r.created} added${r.linked ? `, ${r.linked} already linked` : ''}${r.skipped ? `, ${r.skipped} older skipped` : ''}`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed')
    }
  }

  async function handleSeedImport(file: File) {
    try {
      const result = mergeImport(JSON.parse(await file.text()))
      if (!result) {
        toast.error('Not an oto-os data file')
        return
      }
      toast.success(`Merged ${result.rows} records into ${result.tables.join(', ')}`)
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed')
    }
  }

  async function handleTogglePush() {
    setPushBusy(true)
    try {
      if (pushOn) {
        await disablePush()
        setPushOn(false)
        toast('Notifications off')
      } else {
        await enablePush()
        setPushOn(true)
        toast.success('Notifications on — morning 7:00, check-in 21:30')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Notification setup failed')
    } finally {
      setPushBusy(false)
    }
  }

  async function handleImport(file: File) {
    try {
      const parsed = JSON.parse(await file.text())
      const summary = importV1(parsed)
      const rows = Object.values(summary.tables).reduce((a, b) => a + b, 0)
      toast.success(`Imported ${rows} records + ${summary.values} settings`)
      // Refresh local fields from any imported settings
      setApiKey(getSetting('apiKey'))
      setProxyUrl(getSetting('t212ProxyUrl'))
      setProxySecret(getSetting('t212ProxySecret'))
    } catch (err) {
      toast.error(err instanceof Error ? `Import failed: ${err.message}` : 'Import failed')
    }
  }

  useEffect(() => {
    if (!open) return
    setApiKey(getSetting('apiKey'))
    setProxyUrl(getSetting('t212ProxyUrl'))
    setProxySecret(getSetting('t212ProxySecret'))
    setSyncUrl(getSetting('syncUrl'))
    setSyncSecret(getSetting('syncSecret'))
    isPushEnabled().then(setPushOn).catch(() => setPushOn(false))
    listSnapshots().then(setSnapshots).catch(() => setSnapshots([]))
  }, [open])

  function handleSave() {
    setSetting('apiKey', apiKey.trim())
    setSetting('t212ProxyUrl', proxyUrl.trim())
    setSetting('t212ProxySecret', proxySecret.trim())
    const hadSync = getSetting('syncUrl').length > 0
    setSetting('syncUrl', syncUrl.trim())
    setSetting('syncSecret', syncSecret.trim())
    if (!hadSync && syncUrl.trim()) {
      syncPull().then((applied) => applied && toast.success('Synced from your other device'))
    }
    toast.success('Settings saved')
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-md gap-5 rounded-t-2xl px-5 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle className="font-serif text-2xl">Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="set-key">Anthropic API key</Label>
            <Input
              id="set-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-…"
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Powers the AI voice capture and Mentor. Stored only on this device.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-proxy">Trading 212 proxy URL</Label>
            <Input
              id="set-proxy"
              value={proxyUrl}
              onChange={(e) => setProxyUrl(e.target.value)}
              placeholder="https://…workers.dev/"
              inputMode="url"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="set-secret">Trading 212 proxy secret</Label>
            <Input
              id="set-secret"
              type="password"
              value={proxySecret}
              onChange={(e) => setProxySecret(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="space-y-4 border-t border-border pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-sync-url">Sync URL</Label>
              <Input
                id="set-sync-url"
                value={syncUrl}
                onChange={(e) => setSyncUrl(e.target.value)}
                placeholder="https://oto-sync.….workers.dev"
                inputMode="url"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-sync-secret">Sync secret</Label>
              <Input
                id="set-sync-secret"
                type="password"
                value={syncSecret}
                onChange={(e) => setSyncSecret(e.target.value)}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                Mirrors your data across devices via your own Cloudflare Worker (see repo → workers/).
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              disabled={pushBusy || !syncUrl.trim()}
              onClick={handleTogglePush}
            >
              {pushOn ? 'Disable notifications' : 'Enable notifications'}
            </Button>
            {!pushSupported() && (
              <p className="text-[11px] text-muted-foreground">
                Notifications need the installed home-screen app (iOS 16.4+).
              </p>
            )}
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label>Import v1 data</Label>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleImport(file)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" className="w-full" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> Choose v1 export JSON
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Loads your old app's export into this device. Merges into existing data.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label>Import data / seed</Label>
            <input
              ref={seedRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleSeedImport(file)
                e.target.value = ''
              }}
            />
            <Button variant="secondary" className="w-full" onClick={() => seedRef.current?.click()}>
              <Upload className="size-4" /> Choose data JSON
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Merges an oto-os data file (e.g. the GMAT seed) into this device — adds records, never deletes.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label>Instagram export</Label>
            <input
              ref={igRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleInstagramImport(file)
                e.target.value = ''
              }}
            />
            <div className="flex items-center gap-2">
              <Input
                value={igLimit}
                onChange={(e) => setIgLimit(e.target.value)}
                inputMode="numeric"
                className="w-16 text-center font-mono"
                aria-label="How many recent accounts to import"
              />
              <Button variant="secondary" className="flex-1" onClick={() => igRef.current?.click()}>
                <Upload className="size-4" /> Choose followers/following JSON
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              From Instagram → Settings → Your activity → Download your information (JSON). Adds the
              most recent N accounts you don't already have; existing handles are left alone.
            </p>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label>App version</Label>
            <p className="font-mono text-[11px] text-muted-foreground">
              Build {new Date(__BUILD_TS__).toLocaleString()}
            </p>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                navigator.serviceWorker
                  ?.getRegistration()
                  .then((r) => r?.update())
                  .catch(() => {})
                toast('Checking… the app reloads by itself if there is a new version')
              }}
            >
              <RefreshCw className="size-4" /> Check for update
            </Button>
          </div>

          <div className="space-y-1.5 border-t border-border pt-4">
            <Label>Backup</Label>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                exportBackup()
                toast.success('Backup downloaded')
              }}
            >
              <Download className="size-4" /> Download full backup
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Saves everything on this device as a JSON file. Keep one somewhere safe.
            </p>
            {snapshots.length > 0 && (
              <div className="pt-1">
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Automatic weekly snapshots (kept on this device):
                </p>
                <ul className="divide-y divide-border">
                  {snapshots.map((s) => (
                    <li key={s.id} className="flex items-center justify-between py-1.5">
                      <span className="font-mono text-xs">{s.date}</span>
                      <Button size="sm" variant="ghost" onClick={() => downloadSnapshot(s)}>
                        <Download className="size-3.5" /> Save
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="px-0">
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
