'use client'

import { useState, type Dispatch, type ReactNode, type SetStateAction, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { InlineClickEdit } from '@/components/character-sheet'
import type { InventoryItem, SheetPermissions } from './types'

export function InventoryTab({
  inventoryItems, permissions,
  searchQuery, setSearchQuery,
  totalWeight,
  saveItemField, handleDeleteItem,
  showNewItem, setShowNewItem,
  newItem, setNewItem,
  itemSaving, itemError,
  handleCreateItem, resetNewItem,
  expandedItems, setExpandedItems,
}: {
  readonly inventoryItems: InventoryItem[]; readonly permissions: SheetPermissions
  readonly searchQuery: string; readonly setSearchQuery: Dispatch<SetStateAction<string>>
  readonly totalWeight: number
  readonly saveItemField: (itemId: string, field: string, value: string) => Promise<void>
  readonly handleDeleteItem: (itemId: string) => Promise<void>
  readonly showNewItem: boolean; readonly setShowNewItem: Dispatch<SetStateAction<boolean>>
  readonly newItem: { name: string; weight: string; cost: string; description: string }
  readonly setNewItem: Dispatch<SetStateAction<{ name: string; weight: string; cost: string; description: string }>>
  readonly itemSaving: boolean; readonly itemError: string | null
  readonly handleCreateItem: (e: SubmitEvent) => Promise<void>
  readonly resetNewItem: () => void
  readonly expandedItems: Record<string, boolean>
  readonly setExpandedItems: Dispatch<SetStateAction<Record<string, boolean>>>
}) {
  const { t } = useTranslation()
  const canEditInventory = permissions.canEditInventory
  const [pendingDeleteItemId, setPendingDeleteItemId] = useState<string | null>(null)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const q = searchQuery.toLowerCase()
  const filtered = q
    ? inventoryItems.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.cost || '').toLowerCase().includes(q)
      )
    : inventoryItems

  const pendingDeleteItem = pendingDeleteItemId ? inventoryItems.find(item => item.id === pendingDeleteItemId) ?? null : null

  return (
    <>
      {pendingDeleteItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="card !p-6 max-w-md w-full mx-4 space-y-4 border-danger/20 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
                <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-foreground">{t('common:delete')}</h2>
                <p className="text-sm text-muted-foreground">{t('campaign:actionCannotBeUndone')}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{t('character:deleteConfirm', { name: pendingDeleteItem.name })}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setPendingDeleteItemId(null)} className="btn-ghost text-sm">
                {t('common:cancel')}
              </button>
              <button
                onClick={async () => {
                  setDeletingItemId(pendingDeleteItem.id)
                  await handleDeleteItem(pendingDeleteItem.id)
                  setDeletingItemId(null)
                  setPendingDeleteItemId(null)
                }}
                disabled={deletingItemId === pendingDeleteItem.id}
                className="btn-danger-solid text-sm"
              >
                {deletingItemId === pendingDeleteItem.id ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {t('campaign:deleting')}
                  </span>
                ) : (
                  t('character:deleteForever')
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    <div className="space-y-4 animate-slide-up">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="input-field pl-9 py-1.5 text-sm w-full"
            placeholder={t('character:searchInventoryPlaceholder')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        {inventoryItems.length > 0 && (
          <div className="badge-gold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            {totalWeight.toFixed(1)} kg
          </div>
        )}
      </div>

      {/* Items list / empty state */}
      {filtered.length === 0 && !showNewItem && (
        <div className="card !p-6">
          <div className="text-center py-8 text-muted-foreground">
            {searchQuery ? (
              <div className="space-y-2">
                <svg className="w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p className="text-sm italic">{t('character:noItemsMatchSearch')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <p className="text-sm italic">{t('character:inventoryEmpty')}</p>
                {canEditInventory && <p className="text-xs text-muted">{t('character:addFirstItemBelow')}</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3 stagger-children">
          {filtered.map((item, idx) => {
            let descriptionContent: ReactNode
            if (canEditInventory) {
              descriptionContent = (
                <InlineClickEdit
                  value={item.description ?? ''}
                  onSave={async (v) => saveItemField(item.id, 'description', v)}
                  as="textarea"
                  className="text-sm text-muted-foreground whitespace-pre-wrap"
                  emptyDisplay={t('character:addDescriptionPlaceholder')}
                />
              )
            } else if (item.description) {
              descriptionContent = (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
              )
            } else {
              descriptionContent = (
                <p className="text-sm text-muted italic">{t('character:noDescription')}</p>
              )
            }
            return (
            <div
              key={item.id}
              className={`card !p-5 space-y-3 transition-all duration-200 hover:border-border/80 ${expandedItems[item.id] ? 'border-primary/20' : ''}`}
              style={{ animationDelay: `${idx * 60}ms` }}
            >
              {/* Item header row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  {canEditInventory ? (
                    <InlineClickEdit
                      value={item.name}
                      onSave={async (v) => saveItemField(item.id, 'name', v)}
                      className="text-base font-semibold text-foreground"
                      inputClassName="text-base font-semibold"
                    />
                  ) : (
                    <h4 className="text-base font-semibold text-foreground">{item.name}</h4>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Weight badge */}
                  {item.weight != null && (
                    <span className="text-xs text-muted bg-background/50 px-2 py-0.5 rounded-md border border-border">
                      {item.weight} kg
                    </span>
                  )}
                  {/* Cost badge */}
                  {item.cost && (
                    <span className="badge-gold text-xs px-2 py-0.5 rounded-md whitespace-nowrap">
                      {item.cost}
                    </span>
                  )}
                  {canEditInventory && (
                    <button
                      onClick={() => setPendingDeleteItemId(item.id)}
                      className="text-muted hover:text-danger p-1 transition-colors"
                      title={t('character:deleteItemTitle')}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Inline editable fields for owner */}
              {canEditInventory && (
                <div className="flex flex-wrap gap-4 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    {t('character:weightField')}
                    <InlineClickEdit
                      value={item.weight?.toString() ?? ''}
                      onSave={async (v) => saveItemField(item.id, 'weight', v)}
                      className="!text-xs"
                      inputClassName="!text-xs w-16"
                      emptyDisplay="—"
                    />
                    kg
                  </span>
                  <span className="inline-flex items-center gap-1">
                    {t('character:costField')}
                    <InlineClickEdit
                      value={item.cost ?? ''}
                      onSave={async (v) => saveItemField(item.id, 'cost', v)}
                      className="!text-xs"
                      inputClassName="!text-xs w-20"
                      emptyDisplay="—"
                    />
                  </span>
                </div>
              )}

              {/* Description toggle */}
              <div>
                <button
                  type="button"
                  onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))}
                  className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
                >
                  <svg className={`w-3 h-3 transition-transform duration-200 ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                  </svg>
                  {t('common:description')}
                </button>
                {expandedItems[item.id] && (
                  <div className="mt-2 pl-5 animate-fade-in">
                    {descriptionContent}
                  </div>
                )}
              </div>
            </div>
            )
          })}
        </div>
      )}

      {/* Add Item button */}
      {canEditInventory && !showNewItem && (
        <button onClick={() => setShowNewItem(true)} className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          {t('character:addItem')}
        </button>
      )}

      {/* New Item form */}
      {canEditInventory && showNewItem && (
        <form onSubmit={handleCreateItem} className="card !p-6 space-y-4 border-primary/20">
          <div className="header-accent">
            <h3 className="text-base font-semibold text-gradient">{t('character:newItem')}</h3>
          </div>
          <div>
            <label htmlFor="item-name" className="label">{t('common:name')}</label>
            <input
              id="item-name"
              className="input-field"
              value={newItem.name}
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              required
              placeholder={t('character:itemNamePlaceholder')}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-weight" className="label">{t('character:weightKg')}</label>
              <input
                id="item-weight"
                type="number"
                step="any"
                className="input-field"
                value={newItem.weight}
                onChange={e => setNewItem(p => ({ ...p, weight: e.target.value }))}
                placeholder="3"
              />
            </div>
            <div>
              <label htmlFor="item-cost" className="label">{t('character:cost')}</label>
              <input
                id="item-cost"
                className="input-field"
                value={newItem.cost}
                onChange={e => setNewItem(p => ({ ...p, cost: e.target.value }))}
                placeholder="150 gp"
              />
            </div>
          </div>
          <div>
            <label htmlFor="item-description" className="label">{t('common:description')}</label>
            <textarea
              id="item-description"
              className="input-field resize-none"
              rows={3}
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
              placeholder={t('character:itemDescriptionPlaceholder')}
            />
          </div>
          {itemError && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {itemError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
            <button type="button" onClick={resetNewItem} disabled={itemSaving} className="btn-ghost text-sm">{t('common:cancel')}</button>
            <button type="submit" disabled={itemSaving || !newItem.name.trim()} className="btn-primary text-sm">
              {itemSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  {t('character:creating')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  {t('character:createItem')}
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
    </>
  )
}
