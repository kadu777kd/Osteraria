import { useMemo, useState } from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import { formatPriceBRL } from '../lib/osteriaService';
import type { CartItem, Category, Product } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface MenuSectionProps {
  categories: Category[];
  products: Product[];
  cart: CartItem[];
  onAddToCart: (product: Product) => void;
  onUpdateQty: (productId: string, delta: number) => void;
}

export function MenuSection({
  categories,
  products,
  cart,
  onAddToCart,
  onUpdateQty,
}: MenuSectionProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const activeCategories = useMemo(
    () => categories.filter((c) => c.active).sort((a, b) => a.order - b.order),
    [categories]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.active).sort((a, b) => a.order - b.order),
    [products]
  );

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cart) {
      map.set(item.product.id, item.quantity);
    }
    return map;
  }, [cart]);

  const filteredBySearch = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return activeProducts;
    return activeProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
    );
  }, [activeProducts, searchTerm]);

  const visibleCategories = useMemo(() => {
    if (selectedCategory === 'all') {
      return activeCategories;
    }
    return activeCategories.filter((c) => c.id === selectedCategory);
  }, [activeCategories, selectedCategory]);

  return (
    <section
      id="cardapio"
      className="py-16 sm:py-24 border-b"
      style={{
        backgroundColor: 'var(--osteria-bg)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--osteria-accent)] font-semibold mb-2">
              La Carta
            </p>
            <h2
              className="font-display text-3xl sm:text-5xl font-semibold tracking-tight"
              style={{ color: 'var(--osteria-ink)' }}
            >
              Cardápio Digital
            </h2>
            <p className="text-sm sm:text-base mt-2 max-w-xl" style={{ color: 'var(--osteria-muted)' }}>
              Escolha seus pratos favoritos, ajuste as quantidades e finalize seu pedido diretamente pelo WhatsApp.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--osteria-muted)] pointer-events-none" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar prato ou ingrediente..."
              aria-label="Buscar no cardápio"
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-white border text-sm focus:outline-none focus:ring-2 focus:ring-[#A64B2A]/40"
              style={{
                borderColor: 'var(--osteria-border)',
                color: 'var(--osteria-ink)',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--osteria-muted)] hover:text-[var(--osteria-ink)] cursor-pointer"
                aria-label="Limpar busca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="Categorias do cardápio"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-10 border-b"
          style={{ borderColor: 'var(--osteria-border)' }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[40px] ${
              selectedCategory === 'all'
                ? 'text-white'
                : 'bg-white/70 text-[var(--osteria-muted)] hover:text-[var(--osteria-ink)] border border-[var(--osteria-border)]'
            }`}
            style={
              selectedCategory === 'all' ? { backgroundColor: 'var(--osteria-ink)' } : undefined
            }
          >
            Todas as categorias
          </button>

          {activeCategories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer min-h-[40px] ${
                  isSelected
                    ? 'text-white'
                    : 'bg-white/70 text-[var(--osteria-muted)] hover:text-[var(--osteria-ink)] border border-[var(--osteria-border)]'
                }`}
                style={isSelected ? { backgroundColor: 'var(--osteria-ink)' } : undefined}
              >
                {cat.name}
              </button>
            );
          })}
        </div>

        {/* Categories & Products Grid */}
        <div className="space-y-14">
          {visibleCategories.map((category) => {
            const items = filteredBySearch.filter((p) => p.categoryId === category.id);
            if (items.length === 0) return null;

            return (
              <div key={category.id} className="scroll-mt-24">
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 mb-6 pb-3 border-b border-[var(--osteria-border)]">
                  <div>
                    <h3
                      className="font-display text-2xl sm:text-3xl font-semibold"
                      style={{ color: 'var(--osteria-ink)' }}
                    >
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-xs sm:text-sm mt-1" style={{ color: 'var(--osteria-muted)' }}>
                        {category.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs tabular-nums" style={{ color: 'var(--osteria-muted)' }}>
                    {items.length} {items.length === 1 ? 'opção' : 'opções'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {items.map((product) => {
                    const qty = cartQtyMap.get(product.id) || 0;
                    return (
                      <article
                        key={product.id}
                        className="bg-white rounded-2xl border overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-sm"
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
                            <div className="flex items-start justify-between gap-3">
                              <h4
                                className="font-display text-xl font-semibold leading-snug"
                                style={{ color: 'var(--osteria-ink)' }}
                              >
                                {product.name}
                              </h4>
                            </div>

                            {product.description ? (
                              <p
                                className="text-sm mt-2 leading-relaxed"
                                style={{ color: 'var(--osteria-muted)' }}
                              >
                                {product.description}
                              </p>
                            ) : (
                              <p className="text-xs mt-2 italic text-[var(--osteria-muted)]/75">
                                Preparo artesanal da casa.
                              </p>
                            )}
                          </div>

                          <div className="pt-3 border-t border-[var(--osteria-border)] flex items-center justify-between gap-3">
                            <div>
                              <span
                                className="text-base font-semibold tabular-nums block"
                                style={{ color: 'var(--osteria-ink)' }}
                              >
                                {formatPriceBRL(product.price)}
                              </span>
                              {!product.available && (
                                <span className="text-[11px] font-medium text-[var(--osteria-accent)]">
                                  Temporariamente indisponível
                                </span>
                              )}
                            </div>

                            {qty > 0 ? (
                              <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--osteria-border)] bg-[var(--osteria-bg)] p-1">
                                <button
                                  type="button"
                                  onClick={() => onUpdateQty(product.id, -1)}
                                  className="w-8 h-8 rounded flex items-center justify-center hover:bg-white transition-colors cursor-pointer"
                                  aria-label={`Diminuir quantidade de ${product.name}`}
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-7 text-center text-sm font-semibold tabular-nums">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={!product.available}
                                  onClick={() => onUpdateQty(product.id, 1)}
                                  className="w-8 h-8 rounded flex items-center justify-center hover:bg-white transition-colors cursor-pointer disabled:opacity-40"
                                  aria-label={`Aumentar quantidade de ${product.name}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={!product.available}
                                onClick={() => onAddToCart(product)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed min-h-[40px] whitespace-nowrap shrink-0"
                                style={{ backgroundColor: 'var(--osteria-accent)' }}
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>Adicionar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {visibleCategories.every(
            (cat) => filteredBySearch.filter((p) => p.categoryId === cat.id).length === 0
          ) && (
            <div className="py-12 text-center bg-white rounded-2xl border border-[var(--osteria-border)]">
              <p className="font-display text-2xl font-semibold text-[var(--osteria-ink)]">
                Nenhum prato encontrado
              </p>
              <p className="text-sm text-[var(--osteria-muted)] mt-2 mb-5">
                Tente buscar por outro termo ou visualize todas as categorias do cardápio.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCategory('all');
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
                style={{ backgroundColor: 'var(--osteria-accent)' }}
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
