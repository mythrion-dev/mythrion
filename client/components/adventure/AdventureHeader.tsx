'use client'

interface Adventure {
  id: string; name: string; campaign: string; synopsis: string | null; maxPlayers: number; ownerId: string; createdAt: string; updatedAt: string
}

export function AdventureHeader({ adventure, isGM, userRole, onEdit, onDelete }: {
  adventure: Adventure; isGM: boolean; userRole: string | null; onEdit: () => void; onDelete: () => void
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
              <span
                className={`badge text-[0.6rem] ${isGM ? 'badge-gold' : ''}`}
                style={!isGM ? { background: 'rgba(124,92,231,0.15)', color: '#9070f0', border: '1px solid rgba(124,92,231,0.2)' } : undefined}
              >
                {userRole}
              </span>
            )}
            <span className="text-xs text-muted">
              Created {new Date(adventure.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        </div>
        {isGM && (
          <div className="flex gap-2 shrink-0">
            <button onClick={onEdit} className="btn-ghost">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
            <button onClick={onDelete} className="btn-danger">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
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
