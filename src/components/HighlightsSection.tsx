import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { formatPriceBRL } from '../lib/osteriaService';
import type { Category, Product } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface HighlightsSectionProps {
  products: Product[];
  categories: Category[];
  onAddToCart: (product: Product) => void;
  onSelectProduct?: (product: Product) => void;
}

export function HighlightsSection({
  products,
  categories,
  onAddToCart,
}: HighlightsSectionProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const featuredProducts = products
    .filter((p) => p.active && p.featured)
    .sort((a, b) => a.featuredOrder - b.featuredOrder);

  if (featuredProducts.length === 0) return null;

  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const scrollByAmount = (direction: 'left' | 'right') => {
    if (!scrollerRef.current) return;
    const distance = Math.min(scrollerRef.current.clientWidth * 0.8, 380);
    scrollerRef.current.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <section
      id="destaques"
      className="py-14 sm:py-20 border-b"
      style={{
        backgroundColor: 'var(--osteria-surface)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--osteria-accent)] font-semibold mb-2">
              Seleção da Casa
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl font-semibold tracking-tight"
              style={{ color: 'var(--osteria-ink)' }}
            >
              Destaques do Cardápio
            </h2>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => scrollByAmount('left')}
              className="w-10 h-10 rounded-full border flex items-center justify-center bg-white/80 hover:bg-white transition-colors cursor-pointer"
              style={{ borderColor: 'var(--osteria-border)', color: 'var(--osteria-ink)' }}
              aria-label="Ver destaques anteriores"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByAmount('right')}
              className="w-10 h-10 rounded-full border flex items-center justify-center bg-white/80 hover:bg-white transition-colors cursor-pointer"
              style={{ borderColor: 'var(--osteria-border)', color: 'var(--osteria-ink)' }}
              aria-label="Ver próximos destaques"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Horizontal Swipeable Strip on Mobile + Desktop Scroll/Grid feel */}
        <div
          ref={scrollerRef}
          className="flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory pb-2 -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {featuredProducts.map((product) => {
            const catName = categoryMap.get(product.categoryId) || 'Especialidade';
            return (
              <article
                key={product.id}
                className="snap-start shrink-0 w-[272px] sm:w-[300px] bg-white rounded-2xl border overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                style={{ borderColor: 'var(--osteria-border)' }}
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--osteria-surface)]">
                  <MediaImage
                    src={product.imageUrl}
                    alt={product.name}
                    fallbackLabel={product.name}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                  />
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div>
                    <div className="text-xs text-[var(--osteria-muted)] mb-1 flex items-center gap-1.5">
                      <span>{catName}</span>
                      {!product.available && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[var(--osteria-accent)] font-medium">
                            Indisponível no momento
                          </span>
                        </>
                      )}
                    </div>
                    <h3
                      className="font-display text-xl font-semibold leading-snug"
                      style={{ color: 'var(--osteria-ink)' }}
                    >
                      {product.name}
                    </h3>
                    {product.description ? (
                      <p
                        className="text-xs sm:text-sm mt-2 leading-relaxed line-clamp-2"
                        style={{ color: 'var(--osteria-muted)' }}
                      >
                        {product.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="pt-3 border-t border-[var(--osteria-border)] flex items-center justify-between gap-3">
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: 'var(--osteria-ink)' }}
                    >
                      {formatPriceBRL(product.price)}
                    </span>

                    <button
                      type="button"
                      disabled={!product.available}
                      onClick={() => onAddToCart(product)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed min-h-[38px]"
                      style={{ backgroundColor: 'var(--osteria-accent)' }}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
