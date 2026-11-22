import { useState } from 'react';
import { Lock, Menu, ShoppingBag, X } from 'lucide-react';
import type { SiteSettings } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface NavbarProps {
  settings: SiteSettings;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAdmin: () => void;
  isAdminLoggedIn: boolean;
}

export function Navbar({
  settings,
  cartCount,
  onOpenCart,
  onOpenAdmin,
  isAdminLoggedIn,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { label: 'Destaques', href: '#destaques' },
    { label: 'Cardápio', href: '#cardapio' },
    { label: 'Sobre', href: '#sobre' },
    { label: 'Galeria', href: '#galeria' },
    { label: 'Contato', href: '#contato' },
  ];

  const handleNavClick = () => {
    setMobileOpen(false);
  };

  return (
    <header
      className="sticky top-0 z-40 border-b backdrop-blur-md transition-colors"
      style={{
        backgroundColor: 'color-mix(in srgb, var(--osteria-bg) 92%, transparent)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <a
          href="#inicio"
          className="flex items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A64B2A] rounded min-w-0"
        >
          {settings.logoUrl ? (
            <span className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-[#2A1E17]/15">
              <MediaImage
                src={settings.logoUrl}
                alt={settings.restaurantName}
                className="w-full h-full object-cover"
              />
            </span>
          ) : null}
          <span
            className="font-display text-xl sm:text-2xl font-semibold tracking-tight whitespace-nowrap truncate max-w-[165px] sm:max-w-none"
            style={{ color: 'var(--osteria-ink)' }}
          >
            {settings.restaurantName}
          </span>
        </a>

        {/* Zone 2: Single-line Nav Links */}
        <nav
          aria-label="Navegação principal"
          className="hidden md:flex items-center gap-7 text-sm font-medium"
          style={{ color: 'var(--osteria-muted)' }}
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap shrink-0 py-1 hover:text-[var(--osteria-ink)] border-b border-transparent hover:border-[var(--osteria-accent)] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Visible Administrador Button + Cart Action */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAdmin}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 text-xs font-medium rounded-lg border border-[var(--osteria-border)] text-[var(--osteria-muted)] hover:text-[var(--osteria-ink)] hover:border-[var(--osteria-ink)]/30 bg-white/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            title="Acesso Administrativo"
          >
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>{isAdminLoggedIn ? 'Painel Admin' : 'Administrador'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium text-white transition-opacity hover:opacity-90 whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
            style={{ backgroundColor: 'var(--osteria-accent)' }}
            aria-label={`Abrir pedido com ${cartCount} itens`}
          >
            <ShoppingBag className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Pedido</span>
            <span className="tabular-nums font-semibold">({cartCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-[var(--osteria-border)] text-[var(--osteria-ink)] cursor-pointer shrink-0"
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="md:hidden border-t px-4 py-4 space-y-1"
          style={{
            backgroundColor: 'var(--osteria-bg)',
            borderColor: 'var(--osteria-border)',
          }}
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className="block px-3 py-2.5 rounded-lg text-base font-medium text-[var(--osteria-ink)] hover:bg-[var(--osteria-surface)] transition-colors"
            >
              {item.label}
            </a>
          ))}
        </div>
      )}
    </header>
  );
}
