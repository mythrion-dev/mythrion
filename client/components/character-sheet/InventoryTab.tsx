'use client'

import { InlineClickEdit } from '@/components/character-sheet'
import type { InventoryItem, SheetPermissions } from './types'
import type { SubmitEvent } from 'react'

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
  inventoryItems: InventoryItem[]; permissions: SheetPermissions
  searchQuery: string; setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  totalWeight: number
  saveItemField: (itemId: string, field: string, value: string) => Promise<void>
  handleDeleteItem: (itemId: string) => Promise<void>
  showNewItem: boolean; setShowNewItem: React.Dispatch<React.SetStateAction<boolean>>
  newItem: { name: string; weight: string; cost: string; description: string }
  setNewItem: React.Dispatch<React.SetStateAction<{ name: string; weight: string; cost: string; description: string }>>
  itemSaving: boolean; itemError: string | null
  handleCreateItem: (e: SubmitEvent) => Promise<void>
  resetNewItem: () => void
  expandedItems: Record<string, boolean>
  setExpandedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  const canEditInventory = permissions.canEditInventory
  const q = searchQuery.toLowerCase()
  const filtered = q
    ? inventoryItems.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q) ||
        (i.cost || '').toLowerCase().includes(q)
      )
    : inventoryItems

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Section header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            className="input-field pl-9 py-1.5 text-sm w-full"
            placeholder="Search inventory..."
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
                <p className="text-sm italic">No items match your search.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <svg className="w-10 h-10 mx-auto text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/>
                </svg>
                <p className="text-sm italic">Inventory is empty.</p>
                {canEditInventory && <p className="text-xs text-muted">Add your first item below.</p>}
              </div>
            )}
          </div>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-3 stagger-children">
          {filtered.map((item, idx) => (
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
                      onClick={() => handleDeleteItem(item.id)}
                      className="text-muted hover:text-danger p-1 transition-colors"
                      title="Delete item"
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
                    Weight:
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
                    Cost:
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
                  Description
                </button>
                {expandedItems[item.id] && (
                  <div className="mt-2 pl-5 animate-fade-in">
                    {canEditInventory ? (
                      <InlineClickEdit
                        value={item.description ?? ''}
                        onSave={async (v) => saveItemField(item.id, 'description', v)}
                        as="textarea"
                        className="text-sm text-muted-foreground whitespace-pre-wrap"
                        emptyDisplay="Add a description..."
                      />
                    ) : item.description ? (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{item.description}</p>
                    ) : (
                      <p className="text-sm text-muted italic">No description.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Item button */}
      {canEditInventory && !showNewItem && (
        <button onClick={() => setShowNewItem(true)} className="btn-primary text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Add Item
        </button>
      )}

      {/* New Item form */}
      {canEditInventory && showNewItem && (
        <form onSubmit={handleCreateItem} className="card !p-6 space-y-4 border-primary/20">
          <div className="header-accent">
            <h3 className="text-base font-semibold text-gradient">New Item</h3>
          </div>
          <div>
            <label htmlFor="item-name" className="label">Name</label>
            <input
              id="item-name"
              className="input-field"
              value={newItem.name}
              onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))}
              required
              placeholder="e.g. Long Sword"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="item-weight" className="label">Weight (kg)</label>
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
              <label htmlFor="item-cost" className="label">Cost</label>
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
            <label htmlFor="item-description" className="label">Description</label>
            <textarea
              id="item-description"
              className="input-field resize-none"
              rows={3}
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
              placeholder="A finely crafted steel longsword with a leather-wrapped hilt..."
            />
          </div>
          {itemError && (
            <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">
              {itemError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
            <button type="button" onClick={resetNewItem} disabled={itemSaving} className="btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={itemSaving || !newItem.name.trim()} className="btn-primary text-sm">
              {itemSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
                  </svg>
                  Create Item
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
