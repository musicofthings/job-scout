import { useEffect, useState } from 'react'

interface Props {
  /** Single source (legacy). Prefer `sources` for logo fallback chains. */
  src?: string | null
  /** Ordered candidates; advances on load error. */
  sources?: string[]
  alt: string
  className?: string
  /** Aspect ratio CSS value, e.g. "16 / 10" */
  aspectRatio?: string
  /** Soft pastel wash when no src yet */
  tone?: 'cream' | 'sky' | 'blush' | 'butter' | 'mint'
  /** cover = full-bleed photo; logo = centered brand mark on wash */
  variant?: 'cover' | 'logo'
}

/**
 * Lazy-loading image with a Sensa-style soft placeholder.
 * Supports a fallback chain (company logo → favicon → placeholder).
 */
export function LazyImage({
  src,
  sources,
  alt,
  className = '',
  aspectRatio = '16 / 10',
  tone = 'cream',
  variant = 'cover',
}: Props) {
  const list = (sources?.length ? sources : src ? [src] : []).filter(Boolean) as string[]
  const [index, setIndex] = useState(0)
  const [failedAll, setFailedAll] = useState(false)

  useEffect(() => {
    setIndex(0)
    setFailedAll(false)
  }, [list.join('|')])

  const current = !failedAll && index < list.length ? list[index] : undefined
  const showImage = Boolean(current)

  return (
    <div
      className={`lazy-media tone-${tone} variant-${variant} ${className}`.trim()}
      style={{ aspectRatio }}
      data-loaded={showImage ? 'true' : 'false'}
    >
      {showImage ? (
        <img
          key={current}
          src={current}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (index + 1 < list.length) setIndex((i) => i + 1)
            else setFailedAll(true)
          }}
        />
      ) : (
        <div className="lazy-media-placeholder" aria-hidden>
          <span className="lazy-media-mark" />
        </div>
      )}
    </div>
  )
}
