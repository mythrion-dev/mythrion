'use client'

import { useState, useEffect, useCallback, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { api } from '@/lib/api'
import Link from 'next/link'

interface Adventure {
  id: string
  name: string
  campaign: string
  synopsis: string | null
  maxPlayers: number
  ownerId: string
  createdAt: string
  updatedAt: string
}

interface Member {
  id: string
  role: string
  joinedAt: string
  user: {
    id: string
    email: string
    displayName: string | null
  }
}

interface Invitation {
  id: string
  invitedEmail: string | null
  token: string
  role: string
  status: string
  expiresAt: string
  createdAt: string
  createdBy: {
    id: string
    displayName: string | null
    email: string
  }
}

export default function AdventureDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const { user, loading: authLoading } = useAuth()

  const [adventure, setAdventure] = useState<Adventure | null>(null)
  const [fetching, setFetching] = useState(true)
  const [userRole, setUserRole] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCampaign, setEditCampaign] = useState('')
  const [editSynopsis, setEditSynopsis] = useState('')
  const [editMaxPlayers, setEditMaxPlayers] = useState(4)
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [members, setMembers] = useState<Member[]>([])
  const [showMembers, setShowMembers] = useState(false)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'PLAYER' | 'GM'>('PLAYER')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSending, setInviteSending] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])

  const isGM = userRole === 'GM'

  const fetchAdventure = useCallback(async () => {
    try {
      const data = await api.get<Adventure>(`/adventures/${id}`)
      setAdventure(data)
      setEditName(data.name)
      setEditCampaign(data.campaign)
      setEditSynopsis(data.synopsis ?? '')
      setEditMaxPlayers(data.maxPlayers)
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode
      if (statusCode === 401 || statusCode === 403) {
        router.replace('/login')
      }
    } finally {
      setFetching(false)
    }
  }, [id, router])

  const resolveRole = useCallback(async () => {
    try {
      const all = await api.get<Array<{ id: string; role: string }>>('/me/adventures')
      const entry = all.find((a) => a.id === id)
      if (entry) setUserRole(entry.role)
    } catch { /* ignore */ }
  }, [id])

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
      return
    }
    if (user) {
      fetchAdventure()
      resolveRole()
    }
  }, [authLoading, user, fetchAdventure, resolveRole])

  const fetchMembers = useCallback(async () => {
    try {
      const data = await api.get<Member[]>(`/adventures/${id}/members`)
      setMembers(data)
    } catch { /* ignore */ }
  }, [id])

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await api.get<Invitation[]>(`/adventures/${id}/invitations`)
      setInvitations(data)
    } catch { /* ignore */ }
  }, [id])

  async function handleUpdate(e: FormEvent) {
    e.preventDefault()
    setEditError(null)
    setSaving(true)
    try {
      const updated = await api.patch<Adventure>(`/adventures/${id}`, {
        name: editName.trim() || undefined,
        campaign: editCampaign.trim() || undefined,
        synopsis: editSynopsis.trim() || undefined,
        maxPlayers: editMaxPlayers,
      })
      setAdventure(updated)
      setEditing(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleteError(null)
    setDeleting(true)
    try {
      await api.delete(`/adventures/${id}`)
      router.push('/dashboard')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete')
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  async function handleInviteByEmail(e: FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviteSending(true)
    try {
      await api.post(`/adventures/${id}/invitations/email`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      setInviteEmail('')
      fetchInvitations()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setInviteSending(false)
    }
  }

  async function handleInviteByLink() {
    setInviteError(null)
    setInviteSending(true)
    try {
      const result = await api.post<{ inviteUrl: string }>(
        `/adventures/${id}/invitations/link`,
        { role: inviteRole },
      )
      setInviteLink(result.inviteUrl)
      fetchInvitations()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Failed to create link')
    } finally {
      setInviteSending(false)
    }
  }

  async function handleRevokeInvitation(invitationId: string) {
    try {
      await api.post(`/invitations/${invitationId}/revoke`)
      fetchInvitations()
    } catch { /* ignore */ }
  }

  async function handleRemoveMember(targetUserId: string) {
    try {
      await api.delete(`/adventures/${id}/members/${targetUserId}`)
      fetchMembers()
    } catch { /* ignore */ }
  }

  if (authLoading || fetching) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
          <span className="text-sm">Loading...</span>
        </div>
      </main>
    )
  }

  if (!adventure) {
    return (
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="text-sm text-muted-foreground">Adventure not found.</div>
      </main>
    )
  }

  return (
    <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-6 animate-fade-in">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Link>
      </div>

      {!editing ? (
        <div className="space-y-6">
          {/* Header */}
          <AdventureHeader
            adventure={adventure}
            isGM={isGM}
            userRole={userRole}
            onEdit={() => setEditing(true)}
            onDelete={() => setConfirmDelete(true)}
          />

          {/* Members */}
          <CollapsibleSection
            title="Party Members"
            expanded={showMembers}
            onToggle={() => {
              setShowMembers(!showMembers)
              if (!showMembers) { fetchMembers(); if (isGM) fetchInvitations() }
            }}
          >
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <MemberRow key={m.id} member={m} isGM={isGM} isSelf={m.user.id === user?.id} onRemove={() => handleRemoveMember(m.user.id)} />
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Invite (GM only) */}
          {isGM && (
            <CollapsibleSection
              title="Invite Players"
              expanded={showInvite}
              onToggle={() => setShowInvite(!showInvite)}
            >
              <InvitePanel
                inviteRole={inviteRole}
                inviteEmail={inviteEmail}
                inviteLink={inviteLink}
                inviteError={inviteError}
                inviteSending={inviteSending}
                invitations={invitations}
                onRoleChange={setInviteRole}
                onEmailChange={setInviteEmail}
                onInviteByEmail={handleInviteByEmail}
                onInviteByLink={handleInviteByLink}
                onRevoke={handleRevokeInvitation}
              />
            </CollapsibleSection>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatCard icon="📜" label="Quests" value={0} />
            <StatCard icon="⚔️" label="Characters" value={0} />
            <StatCard icon="🗺️" label="Maps" value={0} />
          </div>

          {/* Delete modal */}
          {confirmDelete && (
            <DeleteModal
              name={adventure.name}
              error={deleteError}
              loading={deleting}
              onCancel={() => setConfirmDelete(false)}
              onConfirm={handleDelete}
            />
          )}
        </div>
      ) : (
        <EditForm
          name={editName}
          campaign={editCampaign}
          synopsis={editSynopsis}
          maxPlayers={editMaxPlayers}
          error={editError}
          saving={saving}
          onNameChange={setEditName}
          onCampaignChange={setEditCampaign}
          onSynopsisChange={setEditSynopsis}
          onMaxPlayersChange={setEditMaxPlayers}
          onCancel={() => { setEditing(false); setEditError(null) }}
          onSubmit={handleUpdate}
        />
      )}
    </main>
  )
}

/* ── Sub-components ── */

function AdventureHeader({ adventure, isGM, userRole, onEdit, onDelete }: {
  adventure: Adventure; isGM: boolean; userRole: string | null;
  onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className="card !p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-gradient truncate">{adventure.name}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="badge badge-gold">{adventure.campaign}</span>
            <span className="badge badge-gold">👥 {adventure.maxPlayers} {adventure.maxPlayers === 1 ? 'player' : 'players'}</span>
            {userRole && (
              <span className={`badge text-[0.6rem] ${isGM ? 'badge-gold' : ''}`}
                style={!isGM ? { background: 'rgba(124,92,231,0.15)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.2)' } : undefined}
              >{userRole}</span>
            )}
            <span className="text-xs text-muted">
              Created {new Date(adventure.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
        {isGM && (
          <div className="flex gap-2 shrink-0">
            <button onClick={onEdit} className="btn-ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
              Edit
            </button>
            <button onClick={onDelete} className="btn-danger">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              Delete
            </button>
          </div>
        )}
      </div>
      <hr className="divider" />
      {adventure.synopsis ? (
        <div>
          <h3 className="text-sm font-medium text-muted mb-2">Synopsis</h3>
          <p className="text-foreground/80 leading-relaxed whitespace-pre-wrap text-sm">{adventure.synopsis}</p>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground text-sm italic">
          No synopsis yet.{isGM && ' Click edit to add one.'}
        </div>
      )}
    </div>
  )
}

function CollapsibleSection({ title, expanded, onToggle, children }: {
  title: string; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="card !p-6">
      <button onClick={onToggle} className="flex items-center justify-between w-full text-left">
        <h3 className="font-semibold">{title}</h3>
        <svg className={`w-5 h-5 text-muted transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && <div className="mt-4">{children}</div>}
    </div>
  )
}

function MemberRow({ member, isGM, isSelf, onRemove }: {
  member: Member; isGM: boolean; isSelf: boolean; onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">{member.user.displayName ?? member.user.email}</span>
        <span className={`badge text-[0.6rem] ${member.role === 'GM' ? 'badge-gold' : ''}`}
          style={member.role !== 'GM' ? { background: 'rgba(124,92,231,0.15)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.2)' } : undefined}
        >{member.role}</span>
      </div>
      {isGM && !isSelf && (
        <button onClick={onRemove} className="text-xs text-danger hover:text-danger/80 transition-colors">Remove</button>
      )}
    </div>
  )
}

function InvitePanel(props: {
  inviteRole: string; inviteEmail: string; inviteLink: string | null; inviteError: string | null;
  inviteSending: boolean; invitations: Invitation[];
  onRoleChange: (r: 'PLAYER' | 'GM') => void; onEmailChange: (e: string) => void;
  onInviteByEmail: (e: FormEvent) => void; onInviteByLink: () => void;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <label className="label">Role</label>
        <div className="flex gap-2">
          {(['PLAYER', 'GM'] as const).map((r) => (
            <button key={r} onClick={() => props.onRoleChange(r)}
              className={`btn-ghost text-sm ${props.inviteRole === r ? '!border-primary/40 !text-primary' : ''}`}
            >{r}</button>
          ))}
        </div>
      </div>
      <form onSubmit={props.onInviteByEmail} className="space-y-3">
        <div>
          <label className="label">Invite by Email</label>
          <div className="flex gap-2">
            <input type="email" value={props.inviteEmail} onChange={(e) => props.onEmailChange(e.target.value)}
              className="input-field flex-1" placeholder="player@example.com" />
            <button type="submit" disabled={props.inviteSending || props.inviteEmail.trim().length === 0} className="btn-primary">Send</button>
          </div>
        </div>
      </form>
      <div>
        <label className="label">Invite by Link</label>
        <button onClick={props.onInviteByLink} disabled={props.inviteSending} className="btn-ghost">Generate invite link</button>
        {props.inviteLink && (
          <div className="mt-2 flex items-center gap-2">
            <input readOnly value={props.inviteLink} className="input-field flex-1 text-xs" onFocus={(e) => e.target.select()} />
            <button onClick={() => navigator.clipboard.writeText(props.inviteLink!)} className="btn-ghost text-xs">Copy</button>
          </div>
        )}
      </div>
      {props.inviteError && (
        <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.inviteError}</div>
      )}
      {props.invitations.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted">Pending Invitations</h4>
          {props.invitations.map((inv) => (
            <div key={inv.id} className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground">{inv.invitedEmail ?? 'Link invitation'}</span>
              <button onClick={() => props.onRevoke(inv.id)} className="text-xs text-danger hover:text-danger/80 transition-colors">Revoke</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
  return (
    <div className="card !p-4 text-center">
      <div className="text-xl mb-1">{icon}</div>
      <div className="text-xs text-muted">{label}</div>
      <div className="text-lg font-semibold text-foreground">{value}</div>
    </div>
  )
}

function DeleteModal({ name, error, loading, onCancel, onConfirm }: {
  name: string; error: string | null; loading: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="card !p-6 max-w-sm w-full space-y-4 border-danger/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-danger-muted flex items-center justify-center">
            <svg className="w-5 h-5 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h2 className="font-semibold">Delete Adventure</h2>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Are you sure you want to delete "{name}"?</p>
        {error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{error}</div>}
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} disabled={loading} className="btn-ghost">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="btn-danger-solid">{loading ? 'Deleting...' : 'Delete forever'}</button>
        </div>
      </div>
    </div>
  )
}

function EditForm(props: {
  name: string; campaign: string; synopsis: string; maxPlayers: number;
  error: string | null; saving: boolean;
  onNameChange: (v: string) => void; onCampaignChange: (v: string) => void;
  onSynopsisChange: (v: string) => void; onMaxPlayersChange: (v: number) => void;
  onCancel: () => void; onSubmit: (e: FormEvent) => void;
}) {
  return (
    <form onSubmit={props.onSubmit} className="card !p-6 space-y-4 animate-slide-up">
      <div className="flex items-center gap-3 mb-2">
        <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <h2 className="text-xl font-semibold text-gradient">Edit Adventure</h2>
      </div>
      <div><label className="label">Adventure Name</label><input className="input-field" value={props.name} onChange={(e) => props.onNameChange(e.target.value)} maxLength={100} /></div>
      <div><label className="label">Campaign</label><input className="input-field" value={props.campaign} onChange={(e) => props.onCampaignChange(e.target.value)} maxLength={50} /></div>
      <div>
        <label className="label">Synopsis <span className="text-muted font-normal">(optional)</span></label>
        <textarea className="input-field resize-none" rows={5} value={props.synopsis} onChange={(e) => props.onSynopsisChange(e.target.value)} maxLength={2000} />
        <p className="text-xs text-muted mt-1.5 text-right">{props.synopsis.length}/2000</p>
      </div>
      <div>
        <label className="label">Max Players</label>
        <div className="flex items-center gap-3">
          <input type="range" min={1} max={5} value={props.maxPlayers} onChange={(e) => props.onMaxPlayersChange(Number(e.target.value))}
            className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, #c9a44b 0%, #c9a44b ${((props.maxPlayers - 1) / 4) * 100}%, #2a2240 ${((props.maxPlayers - 1) / 4) * 100}%, #2a2240 100%)` }} />
          <span className="badge badge-gold min-w-[2rem] text-center">{props.maxPlayers}</span>
        </div>
      </div>
      {props.error && <div className="rounded-lg bg-danger-muted border border-danger/30 px-4 py-2.5 text-sm text-danger">{props.error}</div>}
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={props.onCancel} disabled={props.saving} className="btn-ghost">Cancel</button>
        <button type="submit" disabled={props.saving || props.name.trim().length === 0} className="btn-primary">
          {props.saving ? <><div className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin" />Saving...</> : 'Save Changes'}
        </button>
      </div>
    </form>
  )
}