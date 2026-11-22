import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { LOCAL_IMAGE_PATH_MAP } from '../data/seedData';
import { resolveMediaUrl } from '../lib/osteriaService';

interface MediaImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  aspectClass?: string;
}

export function MediaImage({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackLabel,
  aspectClass = '',
}: MediaImageProps) {
  const mappedInitial = src ? LOCAL_IMAGE_PATH_MAP[src] || src : '';
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    if (!mappedInitial) return '';
    return mappedInitial.startsWith('media:') ? '' : mappedInitial;
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    setFailed(false);
    if (!src) {
      setResolvedSrc('');
      return;
    }
    const normalized = LOCAL_IMAGE_PATH_MAP[src] || src;
    if (!normalized.startsWith('media:')) {
      setResolvedSrc(normalized);
      return;
    }
    resolveMediaUrl(normalized).then((url) => {
      if (mounted) {
        setResolvedSrc(url);
        if (!url) setFailed(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [src]);

  if (!src || !resolvedSrc || failed) {
    return (
      <div
        className={`w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F3ECE2] via-[#EBE0D0] to-[#E2D3BE] text-[#6C5B4F] p-6 text-center select-none ${aspectClass}`}
        role="img"
        aria-label={alt}
      >
        <div className="w-11 h-11 rounded-full border border-[#B88B4A]/35 flex items-center justify-center mb-3 bg-[#FAF6F0]/70">
          <UtensilsCrossed className="w-5 h-5 text-[#A64B2A]/80" strokeWidth={1.6} />
        </div>
        <span className="font-display text-base font-semibold text-[#2A1E17]/80 line-clamp-2 max-w-[180px]">
          {fallbackLabel || alt}
        </span>
        <span className="text-[11px] tracking-wide text-[#6C5B4F]/80 mt-1">
          Osteria del Nonno
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
