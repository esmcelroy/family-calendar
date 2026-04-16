import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FamilyMember, MEMBER_COLORS, CalendarPlatform } from '@/lib/types'
import { Plus, Trash, Warning, PencilSimple, Check, X } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface FamilyMembersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: FamilyMember[]
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void
  onDeleteMember: (id: string) => void
  onUpdateMember: (id: string, updates: Partial<Omit<FamilyMember, 'id'>>) => void
}

const PLATFORM_LABELS: Record<CalendarPlatform | 'none', string> = {
  none: 'None / Other',
  google: 'Google Calendar',
  apple: 'Apple Calendar',
  outlook: 'Outlook',
  other: 'Other',
}

function MemberRow({
  member,
  onDelete,
  onUpdate,
}: {
  member: FamilyMember
  onDelete: () => void
  onUpdate: (updates: Partial<Omit<FamilyMember, 'id'>>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [email, setEmail] = useState(member.email ?? '')
  const [platform, setPlatform] = useState<CalendarPlatform | 'none'>(member.preferredPlatform ?? 'none')

  const handleSave = () => {
    onUpdate({
      email: email.trim() || undefined,
      preferredPlatform: platform === 'none' ? undefined : platform,
    })
    setEditing(false)
    toast.success(`${member.name} updated`)
  }

  const handleCancel = () => {
    setEmail(member.email ?? '')
    setPlatform(member.preferredPlatform ?? 'none')
    setEditing(false)
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: member.color }} />
          <div>
            <span className="font-medium">{member.name}</span>
            {member.email ? (
              <p className="text-xs text-muted-foreground">{member.email}</p>
            ) : (
              <p className="text-xs text-amber-500 flex items-center gap-1">
                <Warning size={12} weight="fill" aria-hidden="true" />
                No email — invitations skipped
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)} aria-label={`Edit ${member.name}`}>
            <PencilSimple size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label={`Remove ${member.name}`}>
            <Trash size={18} />
          </Button>
        </div>
      </div>

      {editing && (
        <div className="space-y-3 pt-1 border-t mt-2">
          <div className="space-y-1">
            <Label htmlFor={`email-${member.id}`} className="text-xs">Email address</Label>
            <Input
              id={`email-${member.id}`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preferred calendar</Label>
            <Select value={platform} onValueChange={(v) => setPlatform(v as CalendarPlatform | 'none')}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(PLATFORM_LABELS) as [CalendarPlatform | 'none', string][]).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="gap-1" onClick={handleSave}>
              <Check size={14} weight="bold" /> Save
            </Button>
            <Button size="sm" variant="ghost" className="gap-1" onClick={handleCancel}>
              <X size={14} weight="bold" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

import { SmtpSettingsPanel } from './SmtpSettingsPanel'

export function FamilyMembersSheet({ open, onOpenChange, members, onAddMember, onDeleteMember, onUpdateMember }: FamilyMembersSheetProps) {
  const [newMemberName, setNewMemberName] = useState('')
  const [newMemberEmail, setNewMemberEmail] = useState('')
  const [newMemberPlatform, setNewMemberPlatform] = useState<CalendarPlatform | 'none'>('none')
  const [selectedColor, setSelectedColor] = useState(MEMBER_COLORS[0].value)

  useEffect(() => {
    if (open) {
      const usedColors = members.map((m) => m.color)
      const availableColor = MEMBER_COLORS.find((c) => !usedColors.includes(c.value))
      setSelectedColor(availableColor?.value || MEMBER_COLORS[0].value)
    }
  }, [open, members])

  const handleAddMember = () => {
    if (!newMemberName.trim()) {
      toast.error('Please enter a name')
      return
    }

    onAddMember({
      name: newMemberName.trim(),
      color: selectedColor,
      email: newMemberEmail.trim() || undefined,
      preferredPlatform: newMemberPlatform === 'none' ? undefined : newMemberPlatform,
    })

    setNewMemberName('')
    setNewMemberEmail('')
    setNewMemberPlatform('none')
    toast.success(`${newMemberName.trim()} added to family`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-2xl font-semibold">Family Members</SheetTitle>
          <SheetDescription>
            Add and manage your family members. Each member gets a unique color for easy identification.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-name">Name</Label>
              <Input
                id="member-name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="Enter family member name"
                onKeyDown={(e) => e.key === 'Enter' && handleAddMember()}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="member-email">Email address <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="member-email"
                type="email"
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label>Preferred calendar</Label>
              <Select value={newMemberPlatform} onValueChange={(v) => setNewMemberPlatform(v as CalendarPlatform | 'none')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PLATFORM_LABELS) as [CalendarPlatform | 'none', string][]).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="grid grid-cols-5 gap-2">
                {MEMBER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setSelectedColor(color.value)}
                    className="relative w-full aspect-square rounded-lg transition-all hover:scale-110"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {selectedColor === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={handleAddMember} className="w-full gap-2">
              <Plus size={20} weight="bold" />
              Add Member
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
              Current Members ({members.length})
            </h3>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No family members yet. Add your first member above!
              </p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onDelete={() => {
                      onDeleteMember(member.id)
                      toast.success(`${member.name} removed from family`)
                    }}
                    onUpdate={(updates) => onUpdateMember(member.id, updates)}
                  />
                ))}
              </div>
            )}
          </div>

          <SmtpSettingsPanel />
        </div>
      </SheetContent>
    </Sheet>
  )
}
