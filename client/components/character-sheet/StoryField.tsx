'use client'

export function StoryField({ label, value }: { label: string; value: string | null | undefined }) {
  const text = value?.trim()
  if (!text) return null
  return (
    <div>
      <h4 className="text-sm font-medium text-muted mb-1">{label}</h4>
      <p className="text-sm text-foreground/80 whitespace-pre-wrap">{text}</p>
    </div>
  )
}
