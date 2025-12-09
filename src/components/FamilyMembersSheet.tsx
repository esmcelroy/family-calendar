import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FamilyMember, MEMBER_COLORS } from '@/lib/types'
import { Plus, Trash } from '@phosphor-icons/react'
import { toast } from 'sonner'

interface FamilyMembersSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  members: FamilyMember[]
  onAddMember: (member: Omit<FamilyMember, 'id'>) => void
  onDeleteMember: (id: string) => void
}

export function FamilyMembersSheet({ open, onOpenChange, members, onAddMember, onDeleteMember }: FamilyMembersSheetProps) {
  const [newMemberName, setNewMemberName] = useState('')
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
    })

    setNewMemberName('')
    toast.success(`${newMemberName} added to family`)
  }

  const handleDeleteMember = (id: string, name: string) => {
    onDeleteMember(id)
    toast.success(`${name} removed from family`)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
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
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="font-medium">{member.name}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMember(member.id, member.name)}
                    >
                      <Trash size={18} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
