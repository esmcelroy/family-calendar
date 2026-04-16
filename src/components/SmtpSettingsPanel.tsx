import { useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { STORAGE_KEYS } from '@/lib/storage'
import { SmtpConfig, OrganizerConfig } from '@/lib/types'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Eye, EyeSlash } from '@phosphor-icons/react'
import { toast } from 'sonner'

export function SmtpSettingsPanel() {
  const [smtpConfig, setSmtpConfig] = useLocalStorage<SmtpConfig | null>(STORAGE_KEYS.smtpConfig, null)
  const [organizerConfig, setOrganizerConfig] = useLocalStorage<OrganizerConfig | null>(STORAGE_KEYS.organizerConfig, null)

  const [host, setHost] = useState(smtpConfig?.host ?? '')
  const [port, setPort] = useState(String(smtpConfig?.port ?? 587))
  const [secure, setSecure] = useState(smtpConfig?.secure ?? false)
  const [username, setUsername] = useState(smtpConfig?.username ?? '')
  const [password, setPassword] = useState(smtpConfig?.password ?? '')
  const [fromAddress, setFromAddress] = useState(smtpConfig?.fromAddress ?? '')
  const [fromName, setFromName] = useState(smtpConfig?.fromName ?? '')
  const [orgName, setOrgName] = useState(organizerConfig?.name ?? '')
  const [orgEmail, setOrgEmail] = useState(organizerConfig?.email ?? '')
  const [showPassword, setShowPassword] = useState(false)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    if (host.trim()) {
      setSmtpConfig({
        host: host.trim(),
        port: parseInt(port, 10) || 587,
        secure,
        username: username.trim(),
        password,
        fromAddress: fromAddress.trim(),
        fromName: fromName.trim(),
      })
    } else {
      setSmtpConfig(null)
    }
    if (orgName.trim() && orgEmail.trim()) {
      setOrganizerConfig({ name: orgName.trim(), email: orgEmail.trim() })
    }
    toast.success('Email settings saved')
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const resp = await fetch('/api/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpConfig: { host, port: parseInt(port, 10) || 587, secure, username, password, fromAddress, fromName },
        }),
      })
      const data = await resp.json()
      if (data.status === 'ok') {
        toast.success('SMTP connection successful')
      } else {
        toast.error(`Connection failed: ${data.error}`)
      }
    } catch (err) {
      toast.error(`Connection test error: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTesting(false)
    }
  }

  const isConfigured = !!smtpConfig

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="smtp">
        <AccordionTrigger className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Email / Delivery Settings
          <Badge variant={isConfigured ? 'default' : 'secondary'} className="ml-2 text-xs">
            {isConfigured ? 'SMTP configured' : 'mailto fallback'}
          </Badge>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Configure SMTP to send invitations automatically. Without SMTP, your email client will open for each invitation.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="organizer-name" className="text-xs">Your name (organiser)</Label>
                <Input id="organizer-name" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Jane Smith" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="organizer-email" className="text-xs">Your email (organiser)</Label>
                <Input id="organizer-email" type="email" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} placeholder="jane@example.com" className="h-8 text-sm" />
              </div>
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">SMTP server (optional)</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="smtp-host" className="text-xs">Host</Label>
                  <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.gmail.com" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="smtp-port" className="text-xs">Port</Label>
                  <Input id="smtp-port" value={port} onChange={(e) => setPort(e.target.value)} placeholder="587" className="h-8 text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch id="smtp-secure" checked={secure} onCheckedChange={setSecure} />
                <Label htmlFor="smtp-secure" className="text-xs">TLS/SSL (port 465)</Label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="smtp-username" className="text-xs">Username</Label>
                  <Input id="smtp-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="user@example.com" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="smtp-password" className="text-xs">Password</Label>
                  <div className="relative">
                    <Input
                      id="smtp-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-8 text-sm pr-8"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlash size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="smtp-from-name" className="text-xs">From name</Label>
                  <Input id="smtp-from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Family Calendar" className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="smtp-from-address" className="text-xs">From address</Label>
                  <Input id="smtp-from-address" type="email" value={fromAddress} onChange={(e) => setFromAddress(e.target.value)} placeholder="calendar@example.com" className="h-8 text-sm" />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave}>Save settings</Button>
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || !host.trim()}>
                {testing ? 'Testing…' : 'Test connection'}
              </Button>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
