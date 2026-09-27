import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

// Curated gradient pairs — consistent, offline, no external image dependency.
const GRADIENTS = [
  'from-violet-500 to-purple-700',
  'from-blue-500 to-cyan-600',
  'from-rose-500 to-pink-700',
  'from-amber-500 to-orange-700',
  'from-emerald-500 to-teal-700',
  'from-indigo-500 to-blue-800',
  'from-fuchsia-500 to-purple-800',
  'from-sky-500 to-indigo-700',
]

// A4 portrait ratio (210mm × 297mm) — matches the covers admins upload.
const A4_ASPECT = 'aspect-[210/297]'

function hashSeed(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface BookCoverProps {
  title: string
  seed: string | number
  coverUrl?: string | null
  className?: string
}

export function BookCover({ title, seed, coverUrl, className }: BookCoverProps) {
  if (coverUrl) {
    return (
      <div className={cn(A4_ASPECT, 'w-full overflow-hidden rounded-md bg-muted', className)}>
        <img src={coverUrl} alt={title} className="h-full w-full object-cover" loading="lazy" />
      </div>
    )
  }

  const gradient = GRADIENTS[hashSeed(String(seed)) % GRADIENTS.length]
  const initials = title
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')

  return (
    <div
      className={cn(
        A4_ASPECT,
        'relative flex w-full items-center justify-center overflow-hidden rounded-md bg-gradient-to-br shadow-inner',
        gradient,
        className,
      )}
    >
      <BookOpen className="absolute size-10 text-white/25" strokeWidth={1.5} />
      <span className="relative text-lg font-semibold tracking-wide text-white/90 drop-shadow-sm">
        {initials}
      </span>
    </div>
  )
}
