import { useEffect, useRef, useState } from 'react'
import { Upload, Download } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getSetting, setSetting } from '@/store/settings'
import { importV1 } from '@/lib/importV1'
import { exportBackup } from '@/lib/exportData'
import { toast } from 'sonner'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const [apiKey, setApiKey] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [proxySecret, setProxySecret] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

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
  }, [open])

  function handleSave() {
    setSetting('apiKey', apiKey.trim())
    setSetting('t212ProxyUrl', proxyUrl.trim())
    setSetting('t212ProxySecret', proxySecret.trim())
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
              Powers the AI meal logger and Mentor. Stored only on this device.
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
          </div>
        </div>

        <SheetFooter className="px-0">
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
