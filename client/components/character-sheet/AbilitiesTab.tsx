'use client'

import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { api } from '@/lib/api'
import { NumericInput } from '@/components/shared/NumericInput'
import { InlineClickEdit } from '@/components/character-sheet'
import { Select } from '@/components/shared/Select'
import { SummonResourceCard } from './SummonResourceCard'
import type { AttributeDisplay } from './SummonResourceCard'
import type { Ability, AbilityLevel, CharacterSheet, SheetPermissions } from './types'
import type { SubmitEvent } from 'react'

/**
 * Safe formula evaluator — tokenizer + recursive descent parser.
 * Supports arithmetic, parentheses, and Math.* functions.
 * No use of Function() constructor or eval(), so no SonarQube hotspot.
 */
export function evaluateSummonFormula(formula: string, variables: Record<string, number>): number {
  if (!formula || !formula.trim()) return 0

  // ---------- tokenizer ----------
  type Token =
    | { t: 'num'; v: number }
    | { t: 'op'; v: string }
    | { t: 'lparen' | 'rparen' | 'comma' }
    | { t: 'func'; v: string }

  const funcNames = new Set(['floor', 'ceil', 'round', 'max', 'min', 'abs'])
  const funcMap: Record<string, (...args: number[]) => number> = {
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    max: Math.max,
    min: Math.min,
    abs: Math.abs,
  }
  const ops = new Set(['+', '-', '*', '/', '%', '**', '^'])

  function readNumber(src: string, start: number): { token: Token; next: number } {
    let i = start
    while (i < src.length && /[\d.eE]/.test(src[i])) i++
    let numStr = src.slice(start, i)
    // Back up if trailing exponent with no digits
    if (/[eE][-+]?$/.test(numStr)) { i--; numStr = src.slice(start, i) }
    return { token: { t: 'num', v: Number.parseFloat(numStr) }, next: i }
  }

  function readIdentifier(src: string, start: number): { token: Token; next: number } {
    let i = start
    while (i < src.length && /\w/.test(src[i])) i++
    const word = src.slice(start, i)
    if (funcNames.has(word)) return { token: { t: 'func', v: word }, next: i }
    // Unknown identifiers become 0 to avoid crashing
    return { token: { t: 'num', v: variables[word] ?? 0 }, next: i }
  }

  function tokenize(src: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < src.length) {
      const ch = src[i]
      // Skip whitespace
      if (/\s/.test(ch)) { i++; continue }

      // Number
      if (/\d/.test(ch) || (ch === '.' && i + 1 < src.length && /\d/.test(src[i + 1]))) {
        const r = readNumber(src, i)
        tokens.push(r.token); i = r.next; continue
      }

      // ** (two-char operator)
      if (ch === '*' && i + 1 < src.length && src[i + 1] === '*') {
        tokens.push({ t: 'op', v: '**' }); i += 2; continue
      }
      // ^ (shorthand for **)
      if (ch === '^') {
        tokens.push({ t: 'op', v: '**' }); i += 1; continue
      }

      // Single-char operators
      if (ops.has(ch)) {
        tokens.push({ t: 'op', v: ch }); i += 1; continue
      }

      // Parens / comma
      if (ch === '(') { tokens.push({ t: 'lparen' }); i += 1; continue }
      if (ch === ')') { tokens.push({ t: 'rparen' }); i += 1; continue }
      if (ch === ',') { tokens.push({ t: 'comma' }); i += 1; continue }

      // Identifier (function name or variable)
      if (/[a-zA-Z_]/.test(ch)) {
        const r = readIdentifier(src, i)
        tokens.push(r.token); i = r.next; continue
      }

      // Skip anything else
      i++
    }
    return tokens
  }

  // ---------- recursive descent parser ----------
  let pos = 0
  let toks: Token[] = []

  function peek(): Token | undefined { return toks[pos] }
  function consume(): Token | undefined { return toks[pos++] }
  function expect(t: Token['t']): boolean {
    if (peek()?.t === t) { consume(); return true }
    return false
  }

  // expression := term (('+' | '-') term)*
  function parseExpression(): number {
    let left = parseTerm()
    let tok = peek()
    while (tok?.t === 'op' && (tok.v === '+' || tok.v === '-')) {
      consume()
      const right = parseTerm()
      left = tok.v === '+' ? left + right : left - right
      tok = peek()
    }
    return left
  }

  // term := factor (('*' | '/' | '%') factor)*
  function parseTerm(): number {
    let left = parseFactor()
    let tok = peek()
    while (tok?.t === 'op' && (tok.v === '*' || tok.v === '/' || tok.v === '%')) {
      consume()
      const right = parseFactor()
      if (tok.v === '*') left = left * right
      else if (tok.v === '/') left = right !== 0 ? left / right : 0
      else left = right !== 0 ? left % right : 0
      tok = peek()
    }
    return left
  }

  // factor := unary ('**' factor)?
  function parseFactor(): number {
    const base = parseUnary()
    const tok = peek()
    if (tok?.t === 'op' && tok.v === '**') {
      consume()
      const exp = parseFactor() // right-associative
      return Math.pow(base, exp)
    }
    return base
  }

  // unary := '-' unary | '+' unary | atom
  function parseUnary(): number {
    const neg = peek()
    if (neg?.t === 'op' && neg.v === '-') {
      consume(); return -parseUnary()
    }
    const pos = peek()
    if (pos?.t === 'op' && pos.v === '+') {
      consume(); return parseUnary()
    }
    return parseAtom()
  }

  // atom := NUMBER | '(' expression ')' | func '(' args ')'
  function parseAtom(): number {
    const num = peek()
    if (num?.t === 'num') {
      consume()
      return num.v
    }
    if (expect('lparen')) {
      const val = parseExpression()
      expect('rparen')
      return val
    }
    const fnTok = peek()
    if (fnTok?.t === 'func') {
      consume()
      const fn = funcMap[fnTok.v]
      if (!fn) return 0
      expect('lparen')
      const args: number[] = []
      if (peek()?.t !== 'rparen') {
        args.push(parseExpression())
        while (expect('comma')) {
          args.push(parseExpression())
        }
      }
      expect('rparen')
      return fn(...args)
    }
    return 0
  }

  try {
    toks = tokenize(formula)
    pos = 0
    const result = parseExpression()
    return Number.isFinite(result) ? result : 0
  } catch {
    return 0
  }
}

// ---------- module-level helpers (keep render callbacks under the S3776 complexity threshold) ----------

async function saveLevelPatch(
  update: React.Dispatch<React.SetStateAction<Ability[]>>,
  sheetId: string, levelId: string, patch: Partial<AbilityLevel>, childId?: string,
) {
  try {
    await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${levelId}`, patch)
    update(prev => childId ? patchChildAbilityLevel(prev, childId, levelId, patch) : patchAbilityLevel(prev, levelId, patch))
  } catch {}
}

function stopPropagation(e: { stopPropagation(): void }) {
  e.stopPropagation()
}

function patchAbilityLevel(abilities: Ability[], levelId: string, patch: Partial<AbilityLevel>): Ability[] {
  return abilities.map(ab => ({ ...ab, levels: ab.levels.map(l => l.id === levelId ? { ...l, ...patch } : l) }))
}

function patchChildAbilityLevel(abilities: Ability[], childId: string, levelId: string, patch: Partial<AbilityLevel>): Ability[] {
  return abilities.map(ab => ({ ...ab, childAbilities: (ab.childAbilities ?? []).map(c => c.id === childId ? { ...c, levels: c.levels.map(l => l.id === levelId ? { ...l, ...patch } : l) } : c) }))
}

function patchAbility(abilities: Ability[], abilityId: string, patch: Partial<Pick<Ability, 'description' | 'notes'>>): Ability[] {
  return abilities.map(ab => ab.id === abilityId ? { ...ab, ...patch } : ab)
}

function nextAbilityLevelNumber(ability: Ability): number {
  return Math.max(...ability.levels.map(l => Number.parseInt(l.level)).filter(n => !Number.isNaN(n)), 0) + 1
}

function levelNumberById(abilities: Ability[], levelId: string): number | string {
  for (const a of abilities) {
    const l = a.levels.find(l => l.id === levelId)
    if (l) return l.level
  }
  return '?'
}

// ---------- extracted render subcomponents (each stays under the S3776 threshold of 15) ----------

function AbilityCardHeader({
  ability, isExpanded, isAbility, selLevel, canEditAbilities,
  toggleExpand, setSelectedLevels, setConfirmDeleteAbility,
}: Readonly<{
  ability: Ability; isExpanded: boolean; isAbility: boolean
  selLevel: AbilityLevel | undefined; canEditAbilities: boolean
  toggleExpand: (aid: string) => void
  setSelectedLevels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  setConfirmDeleteAbility: React.Dispatch<React.SetStateAction<string | null>>
}>) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => toggleExpand(ability.id)}
      className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-foreground/5 transition-colors"
    >
      <svg className={`w-4 h-4 text-muted transition-transform duration-200 shrink-0 ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
      </svg>
      <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
        <span className="font-semibold text-foreground truncate">{ability.name}</span>
        <span className="badge text-[0.65rem] badge-gold">
          {isAbility ? t('character:abilityType') : t('character:summonType')}
        </span>
        {selLevel && (
          <span className="text-[0.65rem] text-muted">{t('character:levelWithNumber', { level: selLevel.level })}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0" role="presentation" onClick={stopPropagation} onKeyDown={stopPropagation}>
        {isAbility && ability.levels.length > 0 && (
          <Select
            options={ability.levels.map(l => ({ id: l.id, label: t('character:levelWithNumber', { level: l.level }) }))}
            value={selLevel?.id ?? ''}
            onChange={val => setSelectedLevels(prev => ({ ...prev, [ability.id]: val }))}
            size="sm"
            className="text-xs min-w-[80px]"
          />
        )}
        {canEditAbilities && (
          <button
            onClick={() => setConfirmDeleteAbility(ability.id)}
            className="text-muted hover:text-danger p-1 transition-colors"
            title={isAbility ? t('character:deleteAbilityTitle') : t('character:deleteSummonTitle')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        )}
      </div>
    </button>
  )
}

function AbilityLevelMetadata({
  selLevel, canEditAbilities, sheetId, updateAbilities,
}: Readonly<{
  selLevel: AbilityLevel; canEditAbilities: boolean; sheetId: string
  updateAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
}>) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted">
      {canEditAbilities ? (
        <>
          <span className="inline-flex items-center gap-1">
            {t('character:manaField')}
            <InlineClickEdit
              value={selLevel.manaCost?.toString() ?? ''}
              onSave={(v) => saveLevelPatch(updateAbilities, sheetId, selLevel.id, { manaCost: v.trim() ? Number.parseInt(v, 10) : null })}
              className="!text-xs"
              inputClassName="!text-xs w-16"
              emptyDisplay="—"
            />
          </span>
          <span className="inline-flex items-center gap-1">
            {t('character:rangeField')}
            <InlineClickEdit
              value={selLevel.range ?? ''}
              onSave={(v) => saveLevelPatch(updateAbilities, sheetId, selLevel.id, { range: v.trim() || null })}
              className="!text-xs"
              inputClassName="!text-xs w-20"
              emptyDisplay="—"
            />
          </span>
          {selLevel.damage != null && (
            <span className="inline-flex items-center gap-1">
              {t('character:damageField')}
              <InlineClickEdit
                value={selLevel.damage ?? ''}
                onSave={(v) => saveLevelPatch(updateAbilities, sheetId, selLevel.id, { damage: v.trim() || null })}
                className="!text-xs"
                inputClassName="!text-xs w-16"
                emptyDisplay="—"
              />
            </span>
          )}
        </>
      ) : (
        <>
          {selLevel.manaCost != null && <span>{t('character:manaField')} {selLevel.manaCost}</span>}
          {selLevel.range && <span>{t('character:rangeField')} {selLevel.range}</span>}
          {selLevel.damage && <span>{t('character:damageField')} {selLevel.damage}</span>}
        </>
      )}
    </div>
  )
}

function AbilityLevelDescriptionNotes({
  selLevel, canEditAbilities, sheetId, updateAbilities,
}: Readonly<{
  selLevel: AbilityLevel; canEditAbilities: boolean; sheetId: string
  updateAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
}>) {
  const { t } = useTranslation()
  return (
    <>
      {canEditAbilities ? (
        <div>
          <h5 className="text-xs font-medium text-muted mb-1">{t('common:description')}</h5>
          <InlineClickEdit
            value={selLevel.description ?? ''}
            onSave={(v) => saveLevelPatch(updateAbilities, sheetId, selLevel.id, { description: v.trim() || null })}
            as="textarea"
            className="text-sm text-muted-foreground whitespace-pre-wrap"
            emptyDisplay={t('character:addDescription')}
          />
        </div>
      ) : selLevel.description && (
        <div>
          <h5 className="text-xs font-medium text-muted mb-1">{t('common:description')}</h5>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{selLevel.description}</p>
        </div>
      )}
      {canEditAbilities ? (
        <div>
          <h5 className="text-xs font-medium text-muted mb-1">{t('character:notes')}</h5>
          <InlineClickEdit
            value={selLevel.notes ?? ''}
            onSave={(v) => saveLevelPatch(updateAbilities, sheetId, selLevel.id, { notes: v.trim() || null })}
            as="textarea"
            className="text-xs text-muted italic whitespace-pre-wrap"
            emptyDisplay={t('character:addNotes')}
          />
        </div>
      ) : selLevel.notes && (
        <div>
          <h5 className="text-xs font-medium text-muted mb-1">{t('character:notes')}</h5>
          <p className="text-xs text-muted italic whitespace-pre-wrap">{selLevel.notes}</p>
        </div>
      )}
    </>
  )
}

function AbilityLevelDetails({
  ability, selLevel, canEditAbilities, sheetId, updateAbilities,
  setShowAddLevelModal, setNewLevelForm, setLevelModalError, setConfirmDeleteLevel,
}: Readonly<{
  ability: Ability; selLevel: AbilityLevel | undefined; canEditAbilities: boolean; sheetId: string
  updateAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
  setShowAddLevelModal: React.Dispatch<React.SetStateAction<string | null>>
  setNewLevelForm: React.Dispatch<React.SetStateAction<{ level: number | string; copyFromPrevious: boolean }>>
  setLevelModalError: React.Dispatch<React.SetStateAction<string | null>>
  setConfirmDeleteLevel: React.Dispatch<React.SetStateAction<string | null>>
}>) {
  const { t } = useTranslation()
  if (!selLevel) {
    return (
      <div className="flex items-center justify-between pt-2">
        <p className="text-xs text-muted italic">{t('character:noLevelsAddedYet')}</p>
        {canEditAbilities && (
          <button
            onClick={() => { setShowAddLevelModal(ability.id); setNewLevelForm({ level: 1, copyFromPrevious: false }); setLevelModalError(null) }}
            className="btn-ghost text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            {t('character:addLevel')}
          </button>
        )}
      </div>
    )
  }

  return (
    <>
      {canEditAbilities && ability.levels.length > 1 && (
        <div className="flex justify-end">
          <button
            onClick={() => setConfirmDeleteLevel(selLevel.id)}
            className="text-[0.65rem] text-danger/70 hover:text-danger px-2 py-1 transition-colors"
          >
            {t('character:deleteLevelWithNumber', { level: selLevel.level })}
          </button>
        </div>
      )}

      <AbilityLevelMetadata
        selLevel={selLevel}
        canEditAbilities={canEditAbilities}
        sheetId={sheetId}
        updateAbilities={updateAbilities}
      />

      <AbilityLevelDescriptionNotes
        selLevel={selLevel}
        canEditAbilities={canEditAbilities}
        sheetId={sheetId}
        updateAbilities={updateAbilities}
      />

      {canEditAbilities && (
        <button
          onClick={() => { setShowAddLevelModal(ability.id); setNewLevelForm({ level: nextAbilityLevelNumber(ability), copyFromPrevious: ability.levels.length > 0 }); setLevelModalError(null) }}
          className="btn-ghost text-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          {t('character:addLevel')}
        </button>
      )}
    </>
  )
}

function SummonCardSection({
  ability, template, summonModifierResults, summonAcResults, permissions,
  sheetId, updateAbilities,
  saveSummonAttribute, saveSummonAcValue, saveSummonHealth,
  handleAddSummonSkill, handleUpdateSummonSkill, handleRemoveSummonSkill,
  handleAddSummonResistance, handleUpdateSummonResistance, handleRemoveSummonResistance,
}: Readonly<{
  ability: Ability; template: CharacterSheet['template']
  summonModifierResults: Record<string, Record<string, number | null>>
  summonAcResults: Record<string, number | null>
  permissions: SheetPermissions; sheetId: string
  updateAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
  saveSummonAttribute: (abilityId: string, attributeId: string, value: string) => Promise<void>
  saveSummonAcValue: (abilityId: string, value: string) => Promise<void>
  saveSummonHealth: (abilityId: string, field: 'current' | 'maximum', value: number | null) => Promise<void>
  handleAddSummonSkill: (abilityId: string, name: string, manualValue: number) => Promise<void>
  handleRemoveSummonSkill: (abilityId: string, summonSkillId: string) => Promise<void>
  handleUpdateSummonSkill: (abilityId: string, summonSkillId: string, name: string, manualValue: number) => Promise<void>
  handleAddSummonResistance: (abilityId: string, name: string, value: string) => Promise<void>
  handleRemoveSummonResistance: (abilityId: string, summonResistanceId: string) => Promise<void>
  handleUpdateSummonResistance: (abilityId: string, summonResistanceId: string, name: string, value: string) => Promise<void>
}>) {
  const attributeDisplays: AttributeDisplay[] = (ability.summonAttributes ?? []).map(sa => {
    const attr = template.attributes.find(at => at.id === sa.attributeId)
    if (!attr) return null
    const modResult = (summonModifierResults[ability.id] ?? {})[attr.id]
    return {
      key: attr.key,
      name: attr.name,
      value: sa.value,
      modifier: (modResult !== null && modResult !== undefined) ? Math.floor(modResult) : null,
      attributeId: attr.id,
    }
  }).filter((d): d is AttributeDisplay => d !== null)

  return (
    <div className="pt-1">
      <SummonResourceCard
        ability={ability}
        attributeDisplays={attributeDisplays}
        acResult={summonAcResults[ability.id] ?? null}
        permissions={permissions}
        saveSummonAttribute={saveSummonAttribute}
        saveSummonAcValue={saveSummonAcValue}
        saveSummonHealth={saveSummonHealth}
        handleAddSummonSkill={handleAddSummonSkill}
        handleUpdateSummonSkill={handleUpdateSummonSkill}
        handleRemoveSummonSkill={handleRemoveSummonSkill}
          handleAddSummonResistance={handleAddSummonResistance}
          handleUpdateSummonResistance={handleUpdateSummonResistance}
          handleRemoveSummonResistance={handleRemoveSummonResistance}
        saveDescription={async (abilityId, value) => {
          try {
            await api.patch(`/character-sheets/${sheetId}/abilities/${abilityId}`, { description: value.trim() || null })
            updateAbilities(prev => patchAbility(prev, abilityId, { description: value.trim() || null }))
          } catch {}
        }}
        saveNotes={async (abilityId, value) => {
          try {
            await api.patch(`/character-sheets/${sheetId}/abilities/${abilityId}`, { notes: value.trim() || null })
            updateAbilities(prev => patchAbility(prev, abilityId, { notes: value.trim() || null }))
          } catch {}
        }}
      />
    </div>
  )
}

function NewSummonAbilityForm({
  ability, showNewSummonAbility, setShowNewSummonAbility,
  newAbility, setNewAbility, abilityError, abilitySaving, handleCreateSummonAbility, resetNewAbility,
}: Readonly<{
  ability: Ability; showNewSummonAbility: string | null
  setShowNewSummonAbility: React.Dispatch<React.SetStateAction<string | null>>
  newAbility: { name: string; description: string; manaCost: string; range: string; notes: string; damage: string; level: string; hpCurrent: string; hpMax: string }
  setNewAbility: React.Dispatch<React.SetStateAction<{ name: string; description: string; manaCost: string; range: string; notes: string; damage: string; level: string; hpCurrent: string; hpMax: string }>>
  abilityError: string | null; abilitySaving: boolean
  handleCreateSummonAbility: (summonId: string, e: SubmitEvent) => Promise<void>
  resetNewAbility: () => void
}>) {
  const { t } = useTranslation()
  return (
    <>
      {showNewSummonAbility === ability.id ? (
        <form onSubmit={(e) => { handleCreateSummonAbility(ability.id, e); setShowNewSummonAbility(null) }} className="card !p-4 space-y-3 border-primary/20">
          <h5 className="text-xs font-semibold text-primary">{t('character:newAbilityFor', { name: ability.name })}</h5>
          <div>
            <label htmlFor="summon-ability-name" className="text-[0.65rem] text-muted">{t('common:name')}</label>
            <input id="summon-ability-name" className="input-field text-xs" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder={t('character:placeholderChildAbilityName')} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="summon-ability-mana" className="text-[0.65rem] text-muted">{t('character:manaCost')}</label>
              <NumericInput id="summon-ability-mana" className="input-field text-xs" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder={t('character:placeholderChildMana')} />
            </div>
            <div>
              <label htmlFor="summon-ability-range" className="text-[0.65rem] text-muted">{t('character:rangeLabel')}</label>
              <input id="summon-ability-range" className="input-field text-xs" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder={t('character:placeholderChildRange')} />
            </div>
          </div>
          <div>
            <label htmlFor="summon-ability-damage" className="text-[0.65rem] text-muted">{t('character:damageLabel')}</label>
            <input id="summon-ability-damage" className="input-field text-xs" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder={t('character:placeholderChildDamage')} />
          </div>
          <div>
            <label htmlFor="summon-ability-description" className="text-[0.65rem] text-muted">{t('common:description')}</label>
            <textarea id="summon-ability-description" className="input-field resize-none text-xs" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="summon-ability-notes" className="text-[0.65rem] text-muted">{t('character:notes')}</label>
            <textarea id="summon-ability-notes" className="input-field resize-none text-xs" rows={1} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} />
          </div>
          {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-2 py-1 text-[0.65rem] text-danger">{abilityError}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => { setShowNewSummonAbility(null); resetNewAbility() }} className="btn-ghost text-xs">{t('common:cancel')}</button>
            <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-xs">{abilitySaving ? t('character:creating') : t('common:create')}</button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => { setShowNewSummonAbility(ability.id); setNewAbility({ name: '', description: '', manaCost: '', range: '', notes: '', damage: '', level: '', hpCurrent: '', hpMax: '' }) }}
          className="btn-ghost text-xs"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          {t('character:addAbility')}
        </button>
      )}
    </>
  )
}

export function AbilitiesTab({
  abilities, permissions, sheetId, template,
  selectedLevels, setAbilities, setSelectedLevels,
  showNewAbility, setShowNewAbility,
  searchQuery, setSearchQuery,
  newAbilityType, setNewAbilityType,
  newAbility, setNewAbility,
  abilitySaving, abilityError,
  handleCreateAbility, resetNewAbility,
  handleDeleteAbility,
  showAddLevelModal, setShowAddLevelModal,
  newLevelForm, setNewLevelForm,
  levelModalSaving, setLevelModalSaving,
  levelModalError, setLevelModalError,
  expandedAbilities, setExpandedAbilities,
  summonModifierResults, summonAcResults,
  saveSummonAttribute, saveSummonAcValue, saveSummonHealth,
  handleAddSummonSkill, handleRemoveSummonSkill, handleUpdateSummonSkill,
  handleAddSummonResistance, handleUpdateSummonResistance, handleRemoveSummonResistance,
  handleCreateSummonAbility,
}: Readonly<{
  abilities: Ability[]; permissions: SheetPermissions; sheetId: string
  template: CharacterSheet['template']
  selectedLevels: Record<string, string>; setAbilities: React.Dispatch<React.SetStateAction<Ability[]>>
  setSelectedLevels: React.Dispatch<React.SetStateAction<Record<string, string>>>
  showNewAbility: boolean; setShowNewAbility: React.Dispatch<React.SetStateAction<boolean>>
  newAbilityType: 'ABILITY' | 'SUMMON' | null; setNewAbilityType: React.Dispatch<React.SetStateAction<'ABILITY' | 'SUMMON' | null>>
  newAbility: { name: string; description: string; manaCost: string; range: string; notes: string; damage: string; level: string; hpCurrent: string; hpMax: string }
  setNewAbility: React.Dispatch<React.SetStateAction<{ name: string; description: string; manaCost: string; range: string; notes: string; damage: string; level: string; hpCurrent: string; hpMax: string }>>
  abilitySaving: boolean; abilityError: string | null
  handleCreateAbility: (e: SubmitEvent) => Promise<void>; resetNewAbility: () => void
  handleDeleteAbility: (aid: string) => Promise<void>
  showAddLevelModal: string | null; setShowAddLevelModal: React.Dispatch<React.SetStateAction<string | null>>
  newLevelForm: { level: number | string; copyFromPrevious: boolean }; setNewLevelForm: React.Dispatch<React.SetStateAction<{ level: number | string; copyFromPrevious: boolean }>>
  levelModalSaving: boolean; setLevelModalSaving: React.Dispatch<React.SetStateAction<boolean>>
  levelModalError: string | null; setLevelModalError: React.Dispatch<React.SetStateAction<string | null>>
  expandedAbilities: Record<string, boolean>; setExpandedAbilities: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  searchQuery: string; setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  summonModifierResults: Record<string, Record<string, number | null>>
  summonAcResults: Record<string, number | null>
  saveSummonAttribute: (abilityId: string, attributeId: string, value: string) => Promise<void>
  saveSummonAcValue: (abilityId: string, value: string) => Promise<void>
  saveSummonHealth: (abilityId: string, field: 'current' | 'maximum', value: number | null) => Promise<void>
  handleAddSummonSkill: (abilityId: string, name: string, manualValue: number) => Promise<void>
  handleRemoveSummonSkill: (abilityId: string, summonSkillId: string) => Promise<void>
  handleUpdateSummonSkill: (abilityId: string, summonSkillId: string, name: string, manualValue: number) => Promise<void>
  handleCreateSummonAbility: (summonId: string, e: SubmitEvent) => Promise<void>
  handleAddSummonResistance: (abilityId: string, name: string, value: string) => Promise<void>
  handleRemoveSummonResistance: (abilityId: string, summonResistanceId: string) => Promise<void>
  handleUpdateSummonResistance: (abilityId: string, summonResistanceId: string, name: string, value: string) => Promise<void>
}>) {
  const { t } = useTranslation()
  const canEditAbilities = permissions.canEditAbilities
  const [confirmDeleteAbility, setConfirmDeleteAbility] = useState<string | null>(null)
  const [confirmDeleteLevel, setConfirmDeleteLevel] = useState<string | null>(null)
  const [deletingAbility, setDeletingAbility] = useState(false)
  const [deletingLevel, setDeletingLevel] = useState(false)

  const level = confirmDeleteLevel ? levelNumberById(abilities, confirmDeleteLevel) : '?'

  // Summon-scoped ability creation state
  const [showNewSummonAbility, setShowNewSummonAbility] = useState<string | null>(null)

  const toggleExpand = (aid: string) => setExpandedAbilities(prev => ({ ...prev, [aid]: !prev[aid] }))

  function getSelectedLevel(ability: Ability): AbilityLevel | undefined {
    const selId = selectedLevels[ability.id]
    if (selId) return ability.levels.find(l => l.id === selId)
    return ability.levels.at(-1)
  }

  function addLevelToAbility(a: Ability, abilityId: string, level: AbilityLevel): Ability {
    if (a.id === abilityId) {
      return { ...a, levels: [...a.levels, level] }
    }
    if (a.childAbilities) {
      return { ...a, childAbilities: a.childAbilities.map(ca => ca.id === abilityId ? { ...ca, levels: [...ca.levels, level] } : ca) }
    }
    return a
  }

  async function handleAddLevel(abilityId: string) {
    if (!sheetId) return
    setLevelModalSaving(true)
    try {
      const level = await api.post<AbilityLevel>(`/character-sheets/${sheetId}/abilities/${abilityId}/levels`, { level: newLevelForm.level, copyFromPrevious: newLevelForm.copyFromPrevious })
      setAbilities(prev => prev.map(a => addLevelToAbility(a, abilityId, level)))
      setSelectedLevels(prev => ({ ...prev, [abilityId]: level.id }))
      setShowAddLevelModal(null)
    } catch (err) { setLevelModalError(err instanceof Error ? err.message : t('character:failedToCreateLevel')) }
    finally { setLevelModalSaving(false) }
  }

  const q = searchQuery.toLowerCase()
  const filteredAbilities = q ? abilities.filter(a => a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q) || (a.type || '').toLowerCase().includes(q)) : abilities

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Search bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="input-field pl-9 py-1.5 text-sm w-full"
            placeholder={t('character:searchAbilitiesPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {filteredAbilities.length > 0 && (
          <span className="text-xs text-muted whitespace-nowrap">{t('character:entryCount', { count: filteredAbilities.length })}</span>
        )}
      </div>

      {/* Empty state */}
      {filteredAbilities.length === 0 && !showNewAbility && (
        <div className="card !p-6">
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? (
              <div className="space-y-2">
                <svg className="w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p className="text-sm italic">{t('character:noEntriesMatchSearch')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                </svg>
                <p className="text-sm italic">{t('character:noAbilitiesOrSummonsYet')}</p>
                {canEditAbilities && <p className="text-xs text-muted">{t('character:createOneBelow')}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Abilities / Summons list */}
      {filteredAbilities.length > 0 && (
        <div className="space-y-3 stagger-children">
          {filteredAbilities.map(a => {
            const isExpanded = expandedAbilities[a.id] ?? false
            const isAbility = a.type !== 'SUMMON'
            const selLevel = isAbility ? getSelectedLevel(a) : undefined

            return (
              <div key={a.id} className={`card !p-0 overflow-hidden transition-all duration-200 ${isExpanded ? 'border-primary/20' : ''}`}>
                <AbilityCardHeader
                  ability={a}
                  isExpanded={isExpanded}
                  isAbility={isAbility}
                  selLevel={selLevel}
                  canEditAbilities={canEditAbilities}
                  toggleExpand={toggleExpand}
                  setSelectedLevels={setSelectedLevels}
                  setConfirmDeleteAbility={setConfirmDeleteAbility}
                />

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 space-y-3 border-t border-border animate-fade-in">
                    {isAbility && (
                      <AbilityLevelDetails
                        ability={a}
                        selLevel={selLevel}
                        canEditAbilities={canEditAbilities}
                        sheetId={sheetId}
                        updateAbilities={setAbilities}
                        setShowAddLevelModal={setShowAddLevelModal}
                        setNewLevelForm={setNewLevelForm}
                        setLevelModalError={setLevelModalError}
                        setConfirmDeleteLevel={setConfirmDeleteLevel}
                      />
                    )}

                    {/* SUMMON content */}
                    {!isAbility && (
                      <>
                        <SummonCardSection
                        ability={a}
                        template={template}
                        summonModifierResults={summonModifierResults}
                        summonAcResults={summonAcResults}
                        permissions={permissions}
                        sheetId={sheetId}
                        updateAbilities={setAbilities}
                        saveSummonAttribute={saveSummonAttribute}
                        saveSummonAcValue={saveSummonAcValue}
                        saveSummonHealth={saveSummonHealth}
                        handleAddSummonSkill={handleAddSummonSkill}
                        handleUpdateSummonSkill={handleUpdateSummonSkill}
                        handleRemoveSummonSkill={handleRemoveSummonSkill}
                        handleAddSummonResistance={handleAddSummonResistance}
                        handleUpdateSummonResistance={handleUpdateSummonResistance}
                        handleRemoveSummonResistance={handleRemoveSummonResistance}
                      />
                      {/* Child abilities */}
                      <div className="mt-6 space-y-3">
                          <h4 className="text-xs font-semibold text-muted uppercase tracking-wider">{t('character:abilities')}</h4>
                          {(a.childAbilities ?? []).length === 0 && !showNewSummonAbility ? (
                            <div className="text-xs text-muted italic py-2">{t('character:noAbilitiesYet')}</div>
                          ) : (
                            <div className="space-y-2">
                              {(a.childAbilities ?? []).map((ca: Ability) => {
                                const caExpanded = expandedAbilities[ca.id] ?? false
                                const caSelLevel = getSelectedLevel(ca)
                                return (
                                  <div key={ca.id} className={`rounded-lg border transition-all duration-200 ${caExpanded ? 'border-primary/20 bg-background/40' : 'border-border bg-background/20'}`}>
                                    <button
                                      type="button"
                                      onClick={() => setExpandedAbilities(prev => ({ ...prev, [ca.id]: !prev[ca.id] }))}
                                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-foreground/5 transition-colors"
                                    >
                                      <svg className={`w-3.5 h-3.5 text-muted transition-transform duration-200 shrink-0 ${caExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                                      </svg>
                                      <span className="text-sm font-medium text-foreground truncate flex-1">{ca.name}</span>
                                      {canEditAbilities && ca.levels.length > 0 && (
                                        <div role="presentation" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                                          <Select
                                            options={ca.levels.map(l => ({ id: l.id, label: t('character:levelWithNumber', { level: l.level }) }))}
                                            value={caSelLevel?.id ?? ''}
                                            onChange={val => setSelectedLevels(prev => ({ ...prev, [ca.id]: val }))}
                                            size="sm"
                                            className="min-w-[70px] text-[0.6rem]"
                                          />
                                        </div>
                                      )}
                                      {canEditAbilities && (
                                        <div role="presentation" onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()}>
                                          <button onClick={() => handleDeleteAbility(ca.id)} className="text-muted hover:text-danger p-0.5 transition-colors shrink-0">
                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                                            </svg>
                                          </button>
                                        </div>
                                      )}
                                    </button>
                                    {caExpanded && caSelLevel && (
                                      <div className="px-3 pb-3 pt-2 space-y-2 border-t border-border animate-fade-in">
                                        {/* Delete level */}
                                        {canEditAbilities && ca.levels.length > 1 && (
                                          <div className="flex justify-end">
                                            <button
                                              onClick={() => setConfirmDeleteLevel(caSelLevel.id)}
                                              className="text-[0.6rem] text-danger/70 hover:text-danger px-1.5 py-0.5 transition-colors"
                                            >
                                              {t('character:deleteLevelWithNumber', { level: caSelLevel.level })}
                                            </button>
                                          </div>
                                        )}
                                        <div className="flex flex-wrap gap-3 text-xs text-muted">
                                          {canEditAbilities ? (
                                            <>
                                              <span className="inline-flex items-center gap-1">
                                                {t('character:manaField')}
                                                <InlineClickEdit
                                                  value={caSelLevel.manaCost?.toString() ?? ''}
                                                  onSave={async (v) => {
                                                    try {
                                                      await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { manaCost: v.trim() ? Number.parseInt(v, 10) : null })
                                                      setAbilities(prev => patchChildAbilityLevel(prev, ca.id, caSelLevel.id, { manaCost: v.trim() ? Number.parseInt(v, 10) : null }))
                                                    } catch {}
                                                  }}
                                                  className="!text-xs"
                                                  inputClassName="!text-xs w-16"
                                                  emptyDisplay="—"
                                                />
                                              </span>
                                              <span className="inline-flex items-center gap-1">
                                                {t('character:rangeField')}
                                                <InlineClickEdit
                                                  value={caSelLevel.range ?? ''}
                                                  onSave={async (v) => {
                                                    try {
                                                      await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { range: v.trim() || null })
                                                      setAbilities(prev => patchChildAbilityLevel(prev, ca.id, caSelLevel.id, { range: v.trim() || null }))
                                                    } catch {}
                                                  }}
                                                  className="!text-xs"
                                                  inputClassName="!text-xs w-20"
                                                  emptyDisplay="—"
                                                />
                                              </span>
                                              {caSelLevel.damage != null && (
                                                <span className="inline-flex items-center gap-1">
                                                  {t('character:damageField')}
                                                  <InlineClickEdit
                                                    value={caSelLevel.damage ?? ''}
                                                    onSave={async (v) => {
                                                      try {
                                                        await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { damage: v.trim() || null })
                                                        setAbilities(prev => patchChildAbilityLevel(prev, ca.id, caSelLevel.id, { damage: v.trim() || null }))
                                                      } catch {}
                                                    }}
                                                    className="!text-xs"
                                                    inputClassName="!text-xs w-16"
                                                    emptyDisplay="—"
                                                  />
                                                </span>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              {caSelLevel.manaCost != null && <span>{t('character:manaField')} {caSelLevel.manaCost}</span>}
                                              {caSelLevel.range && <span>{t('character:rangeField')} {caSelLevel.range}</span>}
                                              {caSelLevel.damage && <span>{t('character:damageField')} {caSelLevel.damage}</span>}
                                            </>
                                          )}
                                        </div>
                                        {canEditAbilities ? (
                                          <>
                                            <div>
                                              <h5 className="text-xs font-medium text-muted mb-1">{t('common:description')}</h5>
                                              <InlineClickEdit
                                                value={caSelLevel.description ?? ''}
                                                onSave={async (v) => {
                                                  try {
                                                    await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { description: v.trim() || null })
                                                    setAbilities(prev => patchChildAbilityLevel(prev, ca.id, caSelLevel.id, { description: v.trim() || null }))
                                                  } catch {}
                                                }}
                                                as="textarea"
                                                className="text-xs text-muted-foreground whitespace-pre-wrap"
                                                emptyDisplay={t('character:addDescription')}
                                              />
                                            </div>
                                            <div>
                                              <h5 className="text-xs font-medium text-muted mb-1">{t('character:notes')}</h5>
                                              <InlineClickEdit
                                                value={caSelLevel.notes ?? ''}
                                                onSave={async (v) => {
                                                  try {
                                                    await api.patch(`/character-sheets/${sheetId}/abilities/x/levels/${caSelLevel.id}`, { notes: v.trim() || null })
                                                    setAbilities(prev => patchChildAbilityLevel(prev, ca.id, caSelLevel.id, { notes: v.trim() || null }))
                                                  } catch {}
                                                }}
                                                as="textarea"
                                                className="text-xs text-muted italic whitespace-pre-wrap"
                                                emptyDisplay={t('character:addNotes')}
                                              />
                                            </div>
                                            {/* Add level button */}
                                            <div className="flex items-center justify-between pt-1">
                                              {canEditAbilities && (
                                                <button
                                                  onClick={() => { setShowAddLevelModal(ca.id); setNewLevelForm({ level: nextAbilityLevelNumber(ca), copyFromPrevious: ca.levels.length > 0 }); setLevelModalError(null) }}
                                                  className="btn-ghost text-[0.6rem]"
                                                >
                                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                                                  </svg>
                                                  {t('character:addLevel')}
                                                </button>
                                              )}
                                            </div>
                                          </>
                                        ) : (
                                          <>
                                            {caSelLevel.description && <div><h5 className="text-xs font-medium text-muted mb-1">{t('common:description')}</h5><p className="text-xs text-muted-foreground whitespace-pre-wrap">{caSelLevel.description}</p></div>}
                                            {caSelLevel.notes && <div><h5 className="text-xs font-medium text-muted mb-1">{t('character:notes')}</h5><p className="text-xs text-muted italic whitespace-pre-wrap">{caSelLevel.notes}</p></div>}
                                          </>
                                        )}
                                      </div>
                                    )}
                                    {caExpanded && !caSelLevel && (
                                      <div className="px-3 pb-3 pt-2 border-t border-border animate-fade-in">
                                        <div className="flex items-center justify-between">
                                          <p className="text-[0.6rem] text-muted italic">{t('character:noLevelsAddedYet')}</p>
                                          {canEditAbilities && (
                                            <button
                                              onClick={() => { setShowAddLevelModal(ca.id); setNewLevelForm({ level: 1, copyFromPrevious: false }); setLevelModalError(null) }}
                                              className="btn-ghost text-[0.6rem]"
                                            >
                                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                                              </svg>
                                              {t('character:addLevel')}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {canEditAbilities && (
                            <NewSummonAbilityForm
                              ability={a}
                              showNewSummonAbility={showNewSummonAbility}
                              setShowNewSummonAbility={setShowNewSummonAbility}
                              newAbility={newAbility}
                              setNewAbility={setNewAbility}
                              abilityError={abilityError}
                              abilitySaving={abilitySaving}
                              handleCreateSummonAbility={handleCreateSummonAbility}
                              resetNewAbility={resetNewAbility}
                            />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* New Ability / Summon button */}
      {canEditAbilities && !showNewAbility && (
        <button onClick={() => setShowNewAbility(true)} className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          {t('character:newAbilityOrSummon')}
        </button>
      )}

      {/* Create form */}
      {canEditAbilities && showNewAbility && (
        <div className="card !p-6 space-y-4 border-primary/20">
          {!newAbilityType && (
            <>
              <div className="header-accent">
                <h3 className="text-base font-semibold text-gradient">{t('character:whatWouldYouLikeToCreate')}</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setNewAbilityType('ABILITY')} className="card !p-5 hover:border-primary/30 transition-colors text-center space-y-3">
                  <svg className="w-10 h-10 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t('character:abilityType')}</div>
                    <div className="text-xs text-muted mt-0.5">{t('character:abilityDescription')}</div>
                  </div>
                </button>
                <button type="button" onClick={() => setNewAbilityType('SUMMON')} className="card !p-5 hover:border-primary/30 transition-colors text-center space-y-3">
                  <svg className="w-10 h-10 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/>
                  </svg>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t('character:summonType')}</div>
                    <div className="text-xs text-muted mt-0.5">{t('character:summonDescription')}</div>
                  </div>
                </button>
              </div>
              <div className="flex justify-end pt-2 border-t border-border/40">
                <button type="button" onClick={resetNewAbility} className="btn-ghost text-sm">{t('common:cancel')}</button>
              </div>
            </>
          )}
          {newAbilityType === 'ABILITY' && (
            <form onSubmit={handleCreateAbility} className="space-y-4">
              <div className="flex items-center gap-3 header-accent">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <h3 className="text-base font-semibold text-gradient">{t('character:newAbility')}</h3>
              </div>
              <div>
                <label htmlFor="new-ability-name" className="label">{t('common:name')}</label>
                <input id="new-ability-name" className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder={t('character:placeholderNameAbility')} autoFocus />
              </div>
              <div>
                <label htmlFor="new-ability-desc" className="label">{t('common:description')}</label>
                <textarea id="new-ability-desc" className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder={t('character:placeholderAbilityDesc')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label htmlFor="new-ability-level" className="label">{t('character:levelLabel')}</label>
                  <input id="new-ability-level" type="text" className="input-field" value={newAbility.level} onChange={e => setNewAbility(p => ({ ...p, level: e.target.value }))} placeholder={t('character:placeholderLevel')} />
                </div>
                <div>
                  <label htmlFor="new-ability-mana" className="label">{t('character:manaCost')}</label>
                  <NumericInput id="new-ability-mana" className="input-field" value={newAbility.manaCost} onChange={e => setNewAbility(p => ({ ...p, manaCost: e.target.value }))} placeholder={t('character:placeholderMana')} />
                </div>
                <div>
                  <label htmlFor="new-ability-range" className="label">{t('character:rangeLabel')}</label>
                  <input id="new-ability-range" className="input-field" value={newAbility.range} onChange={e => setNewAbility(p => ({ ...p, range: e.target.value }))} placeholder={t('character:placeholderRange')} />
                </div>
              </div>
              <div>
                <label htmlFor="new-ability-dmg" className="label">{t('character:damageLabel')}</label>
                <input id="new-ability-dmg" className="input-field" value={newAbility.damage} onChange={e => setNewAbility(p => ({ ...p, damage: e.target.value }))} placeholder={t('character:placeholderDamage')} />
              </div>
              <div>
                <label htmlFor="new-ability-notes" className="label">{t('character:notes')}</label>
                <textarea id="new-ability-notes" className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} />
              </div>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{abilityError}</div>}
              <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">{t('common:cancel')}</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">
                  {abilitySaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      {t('character:creating')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      {t('character:createAbility')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
          {newAbilityType === 'SUMMON' && (
            <form onSubmit={handleCreateAbility} className="space-y-4">
              <div className="flex items-center gap-3 header-accent">
                <button type="button" onClick={() => setNewAbilityType(null)} className="text-muted hover:text-foreground transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                  </svg>
                </button>
                <h3 className="text-base font-semibold text-gradient">{t('character:newSummon')}</h3>
              </div>
              <div>
                <label htmlFor="new-summon-name" className="label">{t('common:name')}</label>
                <input id="new-summon-name" className="input-field" value={newAbility.name} onChange={e => setNewAbility(p => ({ ...p, name: e.target.value }))} required placeholder={t('character:placeholderNameSummon')} autoFocus />
              </div>
              <div>
                <label htmlFor="new-summon-desc" className="label">{t('common:description')}</label>
                <textarea id="new-summon-desc" className="input-field resize-none" rows={2} value={newAbility.description} onChange={e => setNewAbility(p => ({ ...p, description: e.target.value }))} placeholder={t('character:placeholderSummonDesc')} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-summon-hp-current" className="label">{t('character:healthCurrent')}</label>
                  <NumericInput id="new-summon-hp-current" className="input-field" value={newAbility.hpCurrent} onChange={e => setNewAbility(p => ({ ...p, hpCurrent: e.target.value }))} placeholder={t('character:placeholderHealth')} />
                </div>
                <div>
                  <label htmlFor="new-summon-hp-max" className="label">{t('character:healthMax')}</label>
                  <NumericInput id="new-summon-hp-max" className="input-field" value={newAbility.hpMax} onChange={e => setNewAbility(p => ({ ...p, hpMax: e.target.value }))} placeholder={t('character:placeholderHealth')} />
                </div>
              </div>
              <div>
                <label htmlFor="new-summon-notes" className="label">{t('character:notes')}</label>
                <textarea id="new-summon-notes" className="input-field resize-none" rows={2} value={newAbility.notes} onChange={e => setNewAbility(p => ({ ...p, notes: e.target.value }))} />
              </div>
              <p className="text-xs text-muted italic">{t('character:summonInheritNote')}</p>
              {abilityError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{abilityError}</div>}
              <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
                <button type="button" onClick={resetNewAbility} disabled={abilitySaving} className="btn-ghost text-sm">{t('common:cancel')}</button>
                <button type="submit" disabled={abilitySaving || !newAbility.name.trim()} className="btn-primary text-sm">
                  {abilitySaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                      {t('character:creating')}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                      </svg>
                      {t('character:createSummon')}
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Add Level modal */}
      {showAddLevelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-primary/20">
            <div className="header-accent">
              <h3 className="font-semibold text-gradient">{t('character:createAbilityLevel')}</h3>
            </div>
            <div>
              <label htmlFor="new-level-input" className="label">{t('character:levelLabel')}</label>
              <input id="new-level-input" className="input-field w-full" value={newLevelForm.level} onChange={e => setNewLevelForm(p => ({ ...p, level: e.target.value }))} />
            </div>
            <div>
              <span className="text-xs text-muted block mb-2">{t('character:copyFromPreviousLevel')}</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="copyPrev" checked={newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: true }))} className="accent-primary" />
                  <span className="text-sm text-foreground">{t('common:yes')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="copyPrev" checked={!newLevelForm.copyFromPrevious} onChange={() => setNewLevelForm(p => ({ ...p, copyFromPrevious: false }))} className="accent-primary" />
                  <span className="text-sm text-foreground">{t('common:no')}</span>
                </label>
              </div>
            </div>
            {levelModalError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{levelModalError}</div>}
            <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
              <button type="button" onClick={() => setShowAddLevelModal(null)} disabled={levelModalSaving} className="btn-ghost text-sm">{t('common:cancel')}</button>
              <button type="button" onClick={() => handleAddLevel(showAddLevelModal)} disabled={levelModalSaving} className="btn-primary text-sm">
                {levelModalSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                    {t('character:creating')}
                  </>
                ) : t('common:create')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Ability confirmation */}
      {confirmDeleteAbility && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('character:deleteEntry')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('character:deleteEntryWarning')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              <Trans
                i18nKey="character:deleteAbilityConfirm"
                values={{ name: abilities.find(a => a.id === confirmDeleteAbility)?.name ?? t('character:thisEntry') }}
                components={[<strong key="name" />]}
              />
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteAbility(null)} disabled={deletingAbility} className="btn-ghost">{t('common:cancel')}</button>
              <button onClick={() => { setDeletingAbility(true); handleDeleteAbility(confirmDeleteAbility).finally(() => { setDeletingAbility(false); setConfirmDeleteAbility(null) }) }} disabled={deletingAbility} className="btn-danger-solid">{deletingAbility ? t('character:deleting') : t('common:delete')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Level confirmation */}
      {confirmDeleteLevel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('character:deleteLevel')}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t('character:deleteLevelWarning')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              <Trans
                i18nKey="character:deleteLevelConfirm"
                values={{ level }}
                components={[<strong key="level" />]}
              />
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDeleteLevel(null)} disabled={deletingLevel} className="btn-ghost">{t('common:cancel')}</button>
              <button onClick={async () => { setDeletingLevel(true); try { await api.delete(`/character-sheets/${sheetId}/abilities/x/levels/${confirmDeleteLevel}`); setAbilities(prev => prev.map(a => ({ ...a, levels: a.levels.filter(l => l.id !== confirmDeleteLevel) }))); setSelectedLevels(prev => { const next = { ...prev }; for (const a of abilities) { if (a.levels.some(l => l.id === confirmDeleteLevel)) { const remaining = a.levels.filter(l => l.id !== confirmDeleteLevel); if (next[a.id] === confirmDeleteLevel) { next[a.id] = remaining.at(-1)?.id ?? ''; } break } } return next }) } catch {} finally { setDeletingLevel(false); setConfirmDeleteLevel(null) } }} disabled={deletingLevel} className="btn-danger-solid">{deletingLevel ? t('character:deleting') : t('common:delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
