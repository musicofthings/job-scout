import { useState } from 'react'

interface Props {
  src?: string | null
  alt: string
  className?: string
  /** Aspect ratio CSS value, e.g. "16 / 10" */
  aspectRatio?: string
  /** Soft pastel wash when no src yet */
  tone?: 'cream' | 'sky' | 'blush' | 'butter' | 'mint'
}

/**
 * Lazy-loading image with a Sensa-style soft placeholder.
 * When `src` is missing, renders a decorative media slot for future art.
 */
export function LazyImage({
  src,
  alt,
  className = '',
  aspectRatio = '16 / 10',
  tone = 'cream',
}: Props) {
  const [failed, setFailed] = useState(false)
  const showImage = Boolean(src) && !failed

  return (
    <div
      className={`lazy-media tone-${tone} ${className}`.trim()}
      style={{ aspectRatio }}
      data-loaded={showImage ? 'true' : 'false'}
    >
      {showImage ? (
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="lazy-media-placeholder" aria-hidden>
          <span className="lazy-media-mark" />
        </div>
      )}
    </div>
  )
}
