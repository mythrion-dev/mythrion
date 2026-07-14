'use client'

import { InlineClickEdit } from '@/components/character-sheet'
import type { InventoryItem } from './types'
import type { FormEvent } from 'react'

export function InventoryTab({
  inventoryItems, isOwner,
  searchQuery, setSearchQuery,
  totalWeight,
  saveItemField, handleDeleteItem,
  showNewItem, setShowNewItem,
  newItem, setNewItem,
  itemSaving, itemError,
  handleCreateItem, resetNewItem,
  expandedItems, setExpandedItems,
}: {
  inventoryItems: InventoryItem[]; isOwner: boolean
  searchQuery: string; setSearchQuery: React.Dispatch<React.SetStateAction<string>>
  totalWeight: number
  saveItemField: (itemId: string, field: string, value: string) => Promise<void>
  handleDeleteItem: (itemId: string) => Promise<void>
  showNewItem: boolean; setShowNewItem: React.Dispatch<React.SetStateAction<boolean>>
  newItem: { name: string; weight: string; cost: string; description: string }
  setNewItem: React.Dispatch<React.SetStateAction<{ name: string; weight: string; cost: string; description: string }>>
  itemSaving: boolean; itemError: string | null
  handleCreateItem: (e: FormEvent) => Promise<void>
  resetNewItem: () => void
  expandedItems: Record<string, boolean>
  setExpandedItems: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
}) {
  return (
    <div className="space-y-4">
      <div className="relative">
        <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input className="input-field pl-8 py-1.5 text-sm w-full" placeholder="Search inventory..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
      </div>
      {inventoryItems.length > 0 && (
        <div className="text-sm text-muted text-right">Total Weight: <span className="font-semibold text-foreground">{totalWeight.toFixed(1)} kg</span></div>
      )}
      {(() => {
        const q = searchQuery.toLowerCase()
        const filtered = q ? inventoryItems.filter(i => i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q) || (i.cost || '').toLowerCase().includes(q)) : inventoryItems
        if (filtered.length === 0 && !showNewItem) {
          return <div className="text-center py-6 text-muted-foreground text-sm italic">{searchQuery ? 'No items match your search.' : `No items in inventory. ${isOwner ? 'Add one below.' : ''}`}</div>
        }
        return (
          <div className="space-y-3">
            {filtered.map(item => (
              <div key={item.id} className="card !p-4 space-y-2">
                <div className="flex items-start justify-between">
                  {isOwner ? (
                    <InlineClickEdit value={item.name} onSave={async (v) => saveItemField(item.id, 'name', v)} className="font-semibold text-foreground" />
                  ) : (
                    <h4 className="font-semibold text-foreground">{item.name}</h4>
                  )}
                  {isOwner && (
                    <button onClick={() => handleDeleteItem(item.id)} className="text-xs text-danger hover:text-danger/80 px-2 py-1 transition-colors shrink-0 ml-2">Delete</button>
                  )}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted">
                  {isOwner ? (
                    <>
                      <span className="inline-flex items-center gap-1">Weight: <InlineClickEdit value={item.weight?.toString() ?? ''} onSave={async (v) => saveItemField(item.id, 'weight', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-16" emptyDisplay="—" /> kg</span>
                      <span className="inline-flex items-center gap-1">Cost: <InlineClickEdit value={item.cost ?? ''} onSave={async (v) => saveItemField(item.id, 'cost', v)} className="!text-xs !text-muted" inputClassName="!text-xs w-20" emptyDisplay="—" /></span>
                    </>
                  ) : (
                    <>
                      {item.weight != null && <span>Weight: {item.weight} kg</span>}
                      {item.cost && <span>Cost: {item.cost}</span>}
                    </>
                  )}
                </div>
                {isOwner ? (
                  <div>
                    <button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                      <svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      Description
                    </button>
                    {expandedItems[item.id] && (
                      <div className="mt-1 pl-4">
                        <InlineClickEdit value={item.description ?? ''} onSave={async (v) => saveItemField(item.id, 'description', v)} as="textarea" className="text-sm text-muted-foreground whitespace-pre-wrap" emptyDisplay="Add description..." />
                      </div>
                    )}
                  </div>
                ) : item.description && (
                  <div>
                    <button type="button" onClick={() => setExpandedItems(p => ({ ...p, [item.id]: !p[item.id] }))} className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors">
                      <svg className={`w-3 h-3 transition-transform ${expandedItems[item.id] ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
                      Description
                    </button>
                    {expandedItems[item.id] && <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1 pl-4">{item.description}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })()}

      {isOwner && !showNewItem && (
        <button onClick={() => setShowNewItem(true)} className="btn-primary text-sm">+ Add Item</button>
      )}
      {isOwner && showNewItem && (
        <form onSubmit={handleCreateItem} className="card !p-4 space-y-3 border-primary/20">
          <h4 className="text-sm font-semibold text-primary">New Item</h4>
          <div>
            <label className="text-xs text-muted">Name</label>
            <input className="input-field" value={newItem.name} onChange={e => setNewItem(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Long Sword" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted">Weight (kg)</label>
              <input type="number" step="any" className="input-field" value={newItem.weight} onChange={e => setNewItem(p => ({ ...p, weight: e.target.value }))} placeholder="3" />
            </div>
            <div>
              <label className="text-xs text-muted">Cost</label>
              <input className="input-field" value={newItem.cost} onChange={e => setNewItem(p => ({ ...p, cost: e.target.value }))} placeholder="150 gp" />
            </div>
          </div>
          <div>
            <label className="text-xs text-muted">Description</label>
            <textarea className="input-field resize-none" rows={2} value={newItem.description} onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))} placeholder="Steel longsword forged by..." />
          </div>
          {itemError && <div className="rounded-lg bg-danger-muted border border-danger/30 px-3 py-2 text-xs text-danger">{itemError}</div>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={resetNewItem} disabled={itemSaving} className="btn-ghost text-sm">Cancel</button>
            <button type="submit" disabled={itemSaving || !newItem.name.trim()} className="btn-primary text-sm">{itemSaving ? 'Creating...' : 'Create'}</button>
          </div>
        </form>
      )}
    </div>
  )
}
