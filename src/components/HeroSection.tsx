import { ArrowDownRight, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { buildWhatsAppLink } from '../lib/osteriaService';
import type { SiteSettings } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface HeroSectionProps {
  settings: SiteSettings;
}

export function HeroSection({ settings }: HeroSectionProps) {
  const whatsappHref = buildWhatsAppLink(
    settings.whatsappNumber,
    `${settings.whatsappGreeting || 'Olá! Gostaria de fazer um pedido na Osteria del Nonno.'}`
  );

  return (
    <section
      id="inicio"
      className="relative overflow-hidden border-b"
      style={{
        backgroundColor: 'var(--osteria-bg)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Editorial Copy Column */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 text-xs tracking-[0.14em] uppercase text-[var(--osteria-gold)] font-medium mb-4">
              <span>Manaus, Amazonas</span>
              <span aria-hidden="true">·</span>
              <span>Massas Frescas &amp; Pizza Napoletana</span>
            </div>

            <h1
              className="font-display font-semibold tracking-tight leading-[1.04] mb-5"
              style={{
                fontSize: 'clamp(2.6rem, 4.8vw, 4.25rem)',
                color: 'var(--osteria-ink)',
                textWrap: 'balance',
              }}
            >
              {settings.restaurantName}
            </h1>

            <p
              className="font-display italic text-xl sm:text-2xl leading-snug mb-4 max-w-xl"
              style={{ color: 'var(--osteria-ink)' }}
            >
              {settings.slogan}
            </p>

            <p
              className="text-sm sm:text-base leading-relaxed mb-8 max-w-xl"
              style={{ color: 'var(--osteria-muted)' }}
            >
              {settings.heroHighlight}
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              <a
                href="#cardapio"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-95 whitespace-nowrap shrink-0 min-h-[44px]"
                style={{ backgroundColor: 'var(--osteria-accent)' }}
              >
                <span>{settings.heroCtaMenu || 'VER CARDÁPIO'}</span>
                <ArrowDownRight className="w-4 h-4 shrink-0" />
              </a>

              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold border transition-colors hover:bg-[var(--osteria-surface)] whitespace-nowrap shrink-0 min-h-[44px]"
                style={{
                  borderColor: 'var(--osteria-ink)',
                  color: 'var(--osteria-ink)',
                }}
              >
                <MessageCircle className="w-4 h-4 shrink-0 text-[#25D366]" />
                <span>{settings.heroCtaWhatsapp || 'FAZER PEDIDO PELO WHATSAPP'}</span>
              </a>
            </div>
          </motion.div>

          {/* Hero Pizza Showcase */}
          <motion.div
            initial={{ opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex"
          >
            <div className="relative w-full aspect-[16/11] lg:aspect-auto lg:min-h-[440px] rounded-2xl overflow-hidden border border-[var(--osteria-border)] shadow-sm bg-[var(--osteria-surface)]">
              <MediaImage
                src={settings.heroImageUrl}
                alt={`Pizza napolitana artesanal — ${settings.restaurantName}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 via-black/25 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between text-white/95">
                <div>
                  <p className="font-display text-lg sm:text-xl font-semibold leading-tight">
                    Fermentação Lenta 48h
                  </p>
                  <p className="text-xs text-white/80 mt-0.5">
                    Pizza napolitana &amp; pastificio artesanal
                  </p>
                </div>
                <span className="text-xs font-medium text-white/90 hidden sm:inline">
                  {settings.address}
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Clean 4-column Restaurant Experience Strip */}
        <div
          className="mt-10 pt-8 border-t grid grid-cols-2 lg:grid-cols-4 gap-6 text-sm"
          style={{ borderColor: 'var(--osteria-border)' }}
        >
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: 'var(--osteria-ink)' }}>
              Massa Maturada 48h
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--osteria-muted)' }}>
              Leveza, crocância e borda alveolada inspirada na tradição napolitana.
            </p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: 'var(--osteria-ink)' }}>
              Pastificio Fresco
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--osteria-muted)' }}>
              Massas artesanais preparadas diariamente com ingredientes selecionados.
            </p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: 'var(--osteria-ink)' }}>
              Manaus Plaza Shopping
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--osteria-muted)' }}>
              Atendimento presencial acolhedor e pedidos diretos pelo WhatsApp.
            </p>
          </div>
          <div>
            <p className="font-display text-lg font-semibold" style={{ color: 'var(--osteria-ink)' }}>
              Horário Estendido
            </p>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--osteria-muted)' }}>
              {settings.hoursWeekdays} · {settings.hoursSunday}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
