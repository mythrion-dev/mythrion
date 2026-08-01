'use client'

import { useState } from 'react'
import { InlineText, InlineNumber } from '@/lib/inline-editable'
import { InlineClickEdit } from '@/components/character-sheet'
import { NumericInput } from '@/components/shared/NumericInput'
import { HealthBar } from './HealthBar'
import type { Ability, SheetPermissions } from './types'

export interface AttributeDisplay {
  key: string
  name: string
  value: string
  modifier: number | null
  attributeId: string
}

interface SummonResourceCardProps {
  ability: Ability
  attributeDisplays: AttributeDisplay[]
  acResult: number | null
  permissions: SheetPermissions
  saveSummonAttribute: (abilityId: string, attributeId: string, value: string) => Promise<void>
  saveSummonAcValue: (abilityId: string, value: string) => Promise<void>
  saveSummonHealth: (abilityId: string, field: 'current' | 'maximum', value: number | null) => void
  handleAddSummonSkill: (abilityId: string, name: string, manualValue: number) => Promise<void>
  handleUpdateSummonSkill: (abilityId: string, skillId: string, name: string, manualValue: number) => Promise<void>
  handleRemoveSummonSkill: (abilityId: string, summonSkillId: string) => Promise<void>
  /** Optional: save callback for summon description (moved from AbilitiesTab) */
  saveDescription?: (abilityId: string, value: string) => Promise<void>
  /** Optional: save callback for summon notes (moved from AbilitiesTab) */
  saveNotes?: (abilityId: string, value: string) => Promise<void>
}

export function SummonResourceCard({
  ability,
  attributeDisplays,
  acResult,
  permissions,
  saveSummonAttribute,
  saveSummonAcValue,
  saveSummonHealth,
  handleAddSummonSkill,
  handleUpdateSummonSkill,
  handleRemoveSummonSkill,
  saveDescription,
  saveNotes,
}: SummonResourceCardProps) {
  const canEdit = permissions.canEditAbilities
  const health = ability.summonHealth
  const skills = ability.summonSkills ?? []
  const acValue = ability.summonAcValues?.[0]
  const hasNotes = ability.description || ability.notes || canEdit

  // Skill add form state
  const [showAddSkill, setShowAddSkill] = useState(false)
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillValue, setNewSkillValue] = useState('0')
  const [addingSkill, setAddingSkill] = useState(false)

  async function handleSaveSummonSkillName(skillId: string, name: string) {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) return
    await handleUpdateSummonSkill(ability.id, skillId, name, skill.manualValue)
  }

  async function handleSaveSummonSkillValue(skillId: string, manualValue: number) {
    const skill = skills.find(s => s.id === skillId)
    if (!skill) return
    await handleUpdateSummonSkill(ability.id, skillId, skill.name, manualValue)
  }

  async function handleAddSkillSubmit() {
    const name = newSkillName.trim()
    const value = Number.parseInt(newSkillValue, 10)
    if (!name || Number.isNaN(value)) return
    setAddingSkill(true)
    try {
      await handleAddSummonSkill(ability.id, name, value)
      setShowAddSkill(false)
      setNewSkillName('')
      setNewSkillValue('0')
    } finally {
      setAddingSkill(false)
    }
  }

  function handleCancelAddSkill() {
    setShowAddSkill(false)
    setNewSkillName('')
    setNewSkillValue('0')
  }

  // ── Attribute modifier display ──
  function formatModifier(mod: number | null): string {
    if (mod === null || mod === undefined) return '—'
    const rounded = Math.floor(mod)
    return rounded >= 0 ? `+${rounded}` : `${rounded}`
  }

  // ── Computed AC display value ──
  const acDisplay = acResult !== null ? acResult : acValue?.value ?? null

  // ── Card class shared across sections ──
  const sectionCardClass = 'card !p-4 transition-shadow duration-200 hover:shadow-md'
  const sectionTitleClass = 'text-[0.65rem] font-semibold text-muted uppercase tracking-wider mb-3'

  return (
    <div className="summon-resource-card space-y-4 animate-fade-in">
      {/* ── HEADER Card ── */}
      <div className="card !p-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground truncate">{ability.name}</h3>
        </div>
        <span className="badge badge-gold text-[0.6rem] shrink-0">Summon</span>
      </div>

      {/* ── Row 1: Attributes | Combat ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Attributes Card */}
        {attributeDisplays.length > 0 && (
          <div className={sectionCardClass}>
            <h4 className={sectionTitleClass}>Attributes</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {attributeDisplays.map(attr => (
                <div
                  key={attr.key}
                  className="flex items-center justify-between bg-background/50 border border-border/50 rounded-md px-3 py-2"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-semibold text-muted uppercase shrink-0">{attr.key}</span>
                    {canEdit ? (
                      <InlineNumber
                        value={attr.value || '0'}
                        onSave={async (v: number) => {
                          await saveSummonAttribute(ability.id, attr.attributeId, String(v))
                        }}
                        className="text-sm text-foreground"
                        inputClassName="w-12 text-center text-sm"
                      />
                    ) : (
                      <span className="text-sm text-foreground truncate">{attr.value || '—'}</span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold tabular-nums shrink-0 ml-1 ${
                      attr.modifier === null
                        ? 'text-muted'
                        : attr.modifier < 0
                        ? 'text-red-400'
                        : 'text-green-400'
                    }`}
                  >
                    {formatModifier(attr.modifier)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Combat Card (AC) */}
        <div className={sectionCardClass}>
          <h4 className={sectionTitleClass}>Combat</h4>
          <div className="flex flex-col items-center justify-center py-3">
            <span className="text-3xl font-bold tabular-nums text-foreground leading-none">
              {acDisplay !== null ? acDisplay : '—'}
            </span>
            <span className="text-[0.6rem] text-muted uppercase tracking-wider mt-2">CA / AC</span>
            {canEdit && (
              <div className="mt-3">
                <InlineNumber
                  value={acValue?.value ?? '10'}
                  onSave={async (v: number) => {
                    await saveSummonAcValue(ability.id, String(v))
                  }}
                  className="text-xs"
                  inputClassName="w-20 text-center"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: Health | Skills ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Health Card */}
        <div className={sectionCardClass}>
          <HealthBar
            current={health?.current ?? null}
            maximum={health?.maximum ?? null}
            onChange={(field, value) => saveSummonHealth(ability.id, field, value)}
            permissions={permissions}
          />
        </div>

        {/* Skills Card */}
        <div className={sectionCardClass}>
          <div className="flex items-center justify-between mb-3">
            <h4 className={sectionTitleClass + ' !mb-0'}>Skills</h4>
            {canEdit && !showAddSkill && (
              <button
                onClick={() => setShowAddSkill(true)}
                className="text-xs text-primary hover:underline"
                type="button"
              >
                + Add Skill
              </button>
            )}
          </div>

          {skills.length === 0 && !showAddSkill ? (
            <p className="text-xs text-muted italic">No skills yet. Add one!</p>
          ) : (
            <div className="space-y-1.5">
              {skills.map(skill => (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 bg-background/40 border border-border/40 rounded-md px-3 py-1.5"
                >
                  {canEdit ? (
                    <>
                      <InlineText
                        value={skill.name}
                        onSave={async (name) => handleSaveSummonSkillName(skill.id, name)}
                        placeholder="Skill name"
                        className="flex-1 text-sm font-medium min-w-0"
                        inputClassName="text-sm"
                        emptyDisplay="Unnamed"
                      />
                      <InlineNumber
                        value={String(skill.manualValue)}
                        onSave={async (v: number) => {
                          await handleSaveSummonSkillValue(skill.id, v)
                        }}
                        className="w-16 text-center text-sm tabular-nums font-semibold"
                        inputClassName="w-16 text-center text-sm"
                      />
                      <button
                        onClick={() => handleRemoveSummonSkill(ability.id, skill.id)}
                        className="text-muted hover:text-danger p-1 transition-colors shrink-0"
                        title="Remove skill"
                        type="button"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{skill.name}</span>
                      <span className="text-sm tabular-nums font-semibold text-foreground">{skill.manualValue}</span>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add Skill Form */}
          {showAddSkill && canEdit && (
            <div className="flex items-center gap-2 mt-3 bg-background/50 border border-border/50 rounded-md px-3 py-2">
              <input
                type="text"
                value={newSkillName}
                onChange={e => setNewSkillName(e.target.value)}
                placeholder="Skill name"
                className="flex-1 bg-transparent border border-border rounded px-2 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
                disabled={addingSkill}
              />
              <NumericInput
                value={newSkillValue}
                onChange={e => setNewSkillValue(e.target.value)}
                placeholder="Value"
                className="w-16 text-center text-xs bg-transparent border border-border rounded px-2 py-1 text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary"
                wrapperClassName="w-16 shrink-0"
                inputClassName="!text-center !text-xs"
                min={0}
                disabled={addingSkill}
              />
              <button
                onClick={handleAddSkillSubmit}
                disabled={addingSkill || !newSkillName.trim()}
                className="px-2.5 py-1 text-xs font-semibold rounded-md bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
              >
                Add
              </button>
              <button
                onClick={handleCancelAddSkill}
                disabled={addingSkill}
                className="px-2 py-1 text-xs text-muted hover:text-foreground transition-colors disabled:opacity-40"
                type="button"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Notes Card (Description + Notes) ── */}
      {hasNotes && (
        <div className={sectionCardClass}>
          <h4 className={sectionTitleClass}>Notes</h4>
          <div className="space-y-3">
            {/* Description */}
            {canEdit && saveDescription ? (
              <div>
                <h5 className="text-xs font-medium text-muted mb-1">Description</h5>
                <InlineClickEdit
                  value={ability.description ?? ''}
                  onSave={async (v) => {
                    await saveDescription(ability.id, v)
                  }}
                  as="textarea"
                  rows={2}
                  className="text-sm text-muted-foreground whitespace-pre-wrap"
                  emptyDisplay="Add description..."
                />
              </div>
            ) : ability.description ? (
              <div>
                <h5 className="text-xs font-medium text-muted mb-1">Description</h5>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ability.description}</p>
              </div>
            ) : null}

            {/* Notes */}
            {canEdit && saveNotes ? (
              <div>
                <h5 className="text-xs font-medium text-muted mb-1">Notes</h5>
                <InlineClickEdit
                  value={ability.notes ?? ''}
                  onSave={async (v) => {
                    await saveNotes(ability.id, v)
                  }}
                  as="textarea"
                  rows={2}
                  className="text-xs text-muted italic whitespace-pre-wrap"
                  emptyDisplay="Add notes..."
                />
              </div>
            ) : ability.notes ? (
              <div>
                <h5 className="text-xs font-medium text-muted mb-1">Notes</h5>
                <p className="text-xs text-muted italic whitespace-pre-wrap">{ability.notes}</p>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
