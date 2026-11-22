import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { GalleryItem } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface GallerySectionProps {
  items: GalleryItem[];
}

export function GallerySection({ items }: GallerySectionProps) {
  const activeItems = items.filter((i) => i.active).sort((a, b) => a.order - b.order);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight') {
        setLightboxIndex((prev) => (prev === null ? null : (prev + 1) % activeItems.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + activeItems.length) % activeItems.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, activeItems.length]);

  if (activeItems.length === 0) return null;

  const currentItem = lightboxIndex !== null ? activeItems[lightboxIndex] : null;

  return (
    <section
      id="galeria"
      className="py-16 sm:py-24 border-b"
      style={{
        backgroundColor: 'var(--osteria-bg)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--osteria-accent)] font-semibold mb-2">
              Nossa Mesa
            </p>
            <h2
              className="font-display text-3xl sm:text-5xl font-semibold tracking-tight"
              style={{ color: 'var(--osteria-ink)' }}
            >
              Galeria de Fotografias
            </h2>
            <p className="text-sm sm:text-base mt-2 max-w-xl" style={{ color: 'var(--osteria-muted)' }}>
              Clique em qualquer fotografia para ampliar os detalhes dos pratos da Osteria del Nonno.
            </p>
          </div>
        </div>

        {/* Mobile Horizontal Swipe Carousel / Desktop Grid */}
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-5 overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0">
          {activeItems.map((item, idx) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLightboxIndex(idx)}
              className="group relative snap-start shrink-0 w-[280px] md:w-auto text-left rounded-2xl overflow-hidden border border-[var(--osteria-border)] bg-white cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A64B2A]"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--osteria-surface)]">
                <MediaImage
                  src={item.imageUrl}
                  alt={item.title}
                  fallbackLabel={item.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold text-[var(--osteria-ink)] leading-snug">
                    {item.title}
                  </h3>
                  <Maximize2 className="w-4 h-4 shrink-0 text-[var(--osteria-muted)] group-hover:text-[var(--osteria-accent)] transition-colors mt-1" />
                </div>
                {item.caption && (
                  <p className="text-xs text-[var(--osteria-muted)] mt-1 line-clamp-2 leading-relaxed">
                    {item.caption}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {currentItem && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={currentItem.title}
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-[#1C1410] rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/80 flex items-center justify-center cursor-pointer"
              aria-label="Fechar visualização"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-black">
              <MediaImage
                src={currentItem.imageUrl}
                alt={currentItem.title}
                className="w-full h-full object-contain"
              />

              {activeItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex(
                        (lightboxIndex - 1 + activeItems.length) % activeItems.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/85 flex items-center justify-center cursor-pointer"
                    aria-label="Foto anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIndex((lightboxIndex + 1) % activeItems.length)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/60 text-white hover:bg-black/85 flex items-center justify-center cursor-pointer"
                    aria-label="Próxima foto"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>

            <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-white">
              <div>
                <h3 className="font-display text-2xl font-semibold">{currentItem.title}</h3>
                {currentItem.caption && (
                  <p className="text-sm text-white/75 mt-1">{currentItem.caption}</p>
                )}
              </div>
              <span className="text-xs text-white/60 tabular-nums shrink-0">
                {lightboxIndex + 1} / {activeItems.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
