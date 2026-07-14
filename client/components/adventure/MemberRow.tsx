'use client'

interface Member {
  id: string
  role: string
  joinedAt: string
  user: { id: string; email: string; displayName: string | null }
}

export function MemberRow({
  member,
  isGM,
  isSelf,
  onRemove,
}: {
  member: Member
  isGM: boolean
  isSelf: boolean
  onRemove: () => void
}) {
  return (
    <div className="data-row">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-sm text-foreground truncate">
          {member.user.displayName ?? member.user.email}
        </span>
        <span
          className={`badge text-[0.6rem] ${member.role === 'GM' ? 'badge-gold' : ''}`}
          style={
            member.role !== 'GM'
              ? {
                  background: 'rgba(124,92,231,0.15)',
                  color: '#9070f0',
                  border: '1px solid rgba(124,92,231,0.2)',
                }
              : undefined
          }
        >
          {member.role}
        </span>
      </div>
      {isGM && !isSelf && (
        <button
          onClick={onRemove}
          className="text-xs text-danger hover:text-danger/80 transition-colors shrink-0"
        >
          Remove
        </button>
      )}
    </div>
  )
}
