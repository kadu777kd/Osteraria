import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, ExternalLink, MessageCircle, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import {
  buildWhatsAppLink,
  buildWhatsAppOrderMessage,
  createWhatsAppOrder,
  formatPriceBRL,
} from '../lib/osteriaService';
import type { CartItem, SiteSettings } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  settings: SiteSettings;
  focusOrderInfoKey?: number;
  onUpdateQty: (productId: string, delta: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  settings,
  focusOrderInfoKey = 0,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [lastWhatsappUrl, setLastWhatsappUrl] = useState<string | null>(null);
  const orderInfoRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen || cart.length === 0 || focusOrderInfoKey === 0) return;
    const timer = window.setTimeout(() => {
      orderInfoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nameInputRef.current?.focus({ preventScroll: true });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [isOpen, focusOrderInfoKey, cart.length]);

  if (!isOpen) return null;

  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);
  const subtotal = cart.reduce(
    (acc, item) => acc + (item.product.price ?? 0) * item.quantity,
    0
  );
  const hasUnpricedItems = cart.some(
    (item) => item.product.price === null || item.product.price === undefined
  );

  const handleCheckoutWhatsApp = async () => {
    setErrorMsg('');
    if (cart.length === 0) {
      setErrorMsg('Adicione pelo menos um prato ao carrinho antes de finalizar.');
      return;
    }

    setSubmitting(true);
    try {
      const message = buildWhatsAppOrderMessage({
        restaurantName: settings.restaurantName,
        greeting: settings.whatsappGreeting,
        customerName,
        notes,
        items: cart,
        total: subtotal,
        hasUnpricedItems,
      });

      // Persist order summary in Firestore (non-blocking if offline, still opens WhatsApp)
      try {
        await createWhatsAppOrder({
          customerName: customerName.trim() || 'Cliente via Site',
          notes,
          items: cart,
          total: subtotal,
          hasUnpricedItems,
        });
      } catch (err) {
        console.warn('Não foi possível registrar log do pedido no painel, continuando envio ao WhatsApp:', err);
      }

      const whatsappUrl = buildWhatsAppLink(settings.whatsappNumber, message);
      setLastWhatsappUrl(whatsappUrl);

      const link = document.createElement('a');
      link.href = whatsappUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setErrorMsg('Não foi possível gerar o link do WhatsApp. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Seu Pedido"
        className="relative z-10 w-full max-w-md bg-[#FAF6F0] h-full flex flex-col shadow-2xl border-l border-[var(--osteria-border)]"
      >
        {/* Header */}
        <div className="px-5 py-4 bg-white border-b border-[var(--osteria-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-[var(--osteria-accent)]" />
            <div>
              <h2 className="font-display text-2xl font-semibold text-[var(--osteria-ink)] leading-none">
                Seu Pedido
              </h2>
              <p className="text-xs text-[var(--osteria-muted)] mt-1 tabular-nums">
                {totalItems} {totalItems === 1 ? 'item selecionado' : 'itens selecionados'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-lg hover:bg-[var(--osteria-surface)] flex items-center justify-center text-[var(--osteria-ink)] cursor-pointer"
            aria-label="Fechar carrinho"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {lastWhatsappUrl && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Resumo do pedido pronto!</span>
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Caso o WhatsApp não tenha aberto automaticamente, clique no botão abaixo para enviar seu pedido:
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={lastWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1E8E3E] text-white text-xs font-semibold hover:opacity-95"
                >
                  <span>Abrir WhatsApp agora</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => {
                    onClearCart();
                    setLastWhatsappUrl(null);
                    setCustomerName('');
                    setNotes('');
                  }}
                  className="px-3 py-2 rounded-lg text-xs font-medium text-emerald-900 hover:bg-emerald-100 cursor-pointer"
                >
                  Novo pedido
                </button>
              </div>
            </div>
          )}

          {cart.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-[var(--osteria-surface)] flex items-center justify-center mx-auto mb-4 text-[var(--osteria-accent)]">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="font-display text-2xl font-semibold text-[var(--osteria-ink)]">
                Seu carrinho está vazio
              </h3>
              <p className="text-sm text-[var(--osteria-muted)] mt-2 mb-6 max-w-xs mx-auto">
                Explore as pizzas napolitanas, massas artesanais e sobremesas do cardápio para montar seu pedido.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 rounded-lg text-sm font-semibold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--osteria-accent)' }}
              >
                Continuar escolhendo
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-3">
                {cart.map(({ product, quantity }) => (
                  <li
                    key={product.id}
                    className="bg-white rounded-xl border border-[var(--osteria-border)] p-3.5 flex gap-3.5 items-center"
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-[var(--osteria-surface)]">
                      <MediaImage
                        src={product.imageUrl}
                        alt={product.name}
                        fallbackLabel={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-display text-base font-semibold text-[var(--osteria-ink)] leading-tight truncate">
                          {product.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => onRemoveItem(product.id)}
                          className="p-1 text-[var(--osteria-muted)] hover:text-red-700 transition-colors cursor-pointer shrink-0"
                          aria-label={`Remover ${product.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-xs text-[var(--osteria-muted)] mt-0.5 tabular-nums">
                        {formatPriceBRL(product.price)} / un.
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-2.5">
                        <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--osteria-border)] bg-[var(--osteria-bg)] p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(product.id, -1)}
                            className="w-7 h-7 rounded flex items-center justify-center hover:bg-white cursor-pointer"
                            aria-label={`Diminuir ${product.name}`}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-xs font-semibold tabular-nums">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(product.id, 1)}
                            className="w-7 h-7 rounded flex items-center justify-center hover:bg-white cursor-pointer"
                            aria-label={`Aumentar ${product.name}`}
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <span className="text-sm font-semibold text-[var(--osteria-ink)] tabular-nums">
                          {product.price !== null && product.price !== undefined
                            ? formatPriceBRL(product.price * quantity)
                            : 'A confirmar'}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              {/* Customer Info & Notes */}
              <div
                id="cart-order-info"
                ref={orderInfoRef}
                className="bg-white rounded-xl border border-[#A64B2A]/25 p-4 space-y-3.5 shadow-xs"
              >
                <div className="pb-2 border-b border-[var(--osteria-border)]">
                  <h3 className="font-display text-lg font-semibold text-[var(--osteria-ink)]">
                    Informações do Pedido
                  </h3>
                  <p className="text-xs text-[var(--osteria-muted)] mt-0.5">
                    Preencha seu nome e observações para enviar no WhatsApp.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="cart-customer-name"
                    className="block text-xs font-semibold text-[var(--osteria-ink)] mb-1.5"
                  >
                    Seu nome
                  </label>
                  <input
                    ref={nameInputRef}
                    id="cart-customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Como gostaria de ser chamado?"
                    maxLength={120}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[var(--osteria-border)] bg-[var(--osteria-bg)] text-sm text-[var(--osteria-ink)] focus:outline-none focus:ring-2 focus:ring-[#A64B2A]/35"
                  />
                </div>

                <div>
                  <label
                    htmlFor="cart-order-notes"
                    className="block text-xs font-semibold text-[var(--osteria-ink)] mb-1.5"
                  >
                    Observações do pedido
                  </label>
                  <textarea
                    id="cart-order-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: retirar cebola, entrega ou retirada no balcão..."
                    maxLength={600}
                    className="w-full px-3.5 py-2 rounded-lg border border-[var(--osteria-border)] bg-[var(--osteria-bg)] text-sm text-[var(--osteria-ink)] focus:outline-none focus:ring-2 focus:ring-[#A64B2A]/35 resize-none"
                  />
                </div>
              </div>
            </>
          )}

          {errorMsg && (
            <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-5 py-4 bg-white border-t border-[var(--osteria-border)] space-y-3">
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between text-[var(--osteria-muted)]">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatPriceBRL(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-base font-semibold text-[var(--osteria-ink)] pt-1">
                <span>Total do Pedido</span>
                <span className="tabular-nums text-lg">
                  {formatPriceBRL(subtotal)}
                  {hasUnpricedItems ? ' + itens a confirmar' : ''}
                </span>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting}
              onClick={handleCheckoutWhatsApp}
              className="w-full py-3.5 px-4 rounded-xl bg-[#1F8A4C] hover:bg-[#197540] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60 min-h-[48px]"
            >
              <MessageCircle className="w-5 h-5 shrink-0" />
              <span>
                {submitting ? 'PREPARANDO PEDIDO...' : 'FINALIZAR PEDIDO PELO WHATSAPP'}
              </span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-lg border border-[var(--osteria-border)] text-xs font-semibold text-[var(--osteria-ink)] hover:bg-[var(--osteria-surface)] transition-colors cursor-pointer min-h-[40px]"
            >
              Continuar escolhendo
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}
