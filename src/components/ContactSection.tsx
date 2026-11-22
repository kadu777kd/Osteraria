import { Clock, Instagram, MapPin, MessageCircle } from 'lucide-react';
import { buildWhatsAppLink } from '../lib/osteriaService';
import type { SiteSettings } from '../types/osteria';

interface ContactSectionProps {
  settings: SiteSettings;
}

export function ContactSection({ settings }: ContactSectionProps) {
  const whatsappUrl = buildWhatsAppLink(
    settings.whatsappNumber,
    settings.whatsappGreeting || 'Olá! Gostaria de falar com a Osteria del Nonno.'
  );
  const mapsUrl =
    settings.mapsUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`;
  const instagramUrl =
    settings.instagramUrl ||
    `https://www.instagram.com/${settings.instagramHandle.replace(/^@/, '')}/`;

  return (
    <section
      id="contato"
      className="py-16 sm:py-24"
      style={{ backgroundColor: 'var(--osteria-surface)' }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--osteria-accent)] font-semibold mb-2">
              Visite a Osteria
            </p>
            <h2
              className="font-display text-3xl sm:text-5xl font-semibold tracking-tight mb-4"
              style={{ color: 'var(--osteria-ink)' }}
            >
              Informações &amp; Horários
            </h2>
            <p className="text-sm sm:text-base leading-relaxed" style={{ color: 'var(--osteria-muted)' }}>
              Esperamos por você no coração de Manaus para apreciar nossas massas artesanais e pizzas napolitanas, ou faça seu pedido direto pelo WhatsApp.
            </p>
          </div>

          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Location Card */}
            <div className="bg-white rounded-2xl border border-[var(--osteria-border)] p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-2.5 text-[var(--osteria-accent)] mb-3">
                  <MapPin className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Endereço</span>
                </div>
                <p className="font-display text-xl font-semibold text-[var(--osteria-ink)] leading-snug">
                  {settings.address}
                </p>
              </div>
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--osteria-ink)]/20 text-sm font-medium text-[var(--osteria-ink)] hover:bg-[var(--osteria-surface)] transition-colors min-h-[44px]"
              >
                <MapPin className="w-4 h-4 shrink-0" />
                <span>Ver localização</span>
              </a>
            </div>

            {/* Hours Card */}
            <div className="bg-white rounded-2xl border border-[var(--osteria-border)] p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center gap-2.5 text-[var(--osteria-accent)] mb-3">
                  <Clock className="w-5 h-5 shrink-0" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Funcionamento
                  </span>
                </div>
                <div className="space-y-1.5 text-sm text-[var(--osteria-ink)]">
                  <p className="font-medium">{settings.hoursWeekdays}</p>
                  <p className="font-medium">{settings.hoursSunday}</p>
                </div>
              </div>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-opacity hover:opacity-90 min-h-[44px]"
                style={{ backgroundColor: 'var(--osteria-accent)' }}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>Abrir WhatsApp</span>
              </a>
            </div>

            {/* Social / Instagram Card */}
            <div className="sm:col-span-2 bg-white rounded-2xl border border-[var(--osteria-border)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--osteria-gold)] mb-1">
                  Acompanhe nas redes
                </p>
                <p className="font-display text-2xl font-semibold text-[var(--osteria-ink)]">
                  Instagram {settings.instagramHandle}
                </p>
                <p className="text-xs sm:text-sm text-[var(--osteria-muted)] mt-1">
                  Novidades da cozinha, bastidores do pastificio e fornadas do dia.
                </p>
              </div>
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-[var(--osteria-ink)] text-sm font-semibold text-[var(--osteria-ink)] hover:bg-[var(--osteria-surface)] transition-colors whitespace-nowrap shrink-0 min-h-[44px]"
              >
                <Instagram className="w-4 h-4 shrink-0" />
                <span>Conhecer o Instagram</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
