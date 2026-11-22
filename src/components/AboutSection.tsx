import type { SiteSettings } from '../types/osteria';
import { MediaImage } from './MediaImage';

interface AboutSectionProps {
  settings: SiteSettings;
}

export function AboutSection({ settings }: AboutSectionProps) {
  return (
    <section
      id="sobre"
      className="py-16 sm:py-24 border-b"
      style={{
        backgroundColor: 'var(--osteria-surface)',
        borderColor: 'var(--osteria-border)',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          <div className="lg:col-span-6">
            <div className="w-full h-full min-h-[320px] aspect-[4/3] rounded-2xl overflow-hidden border border-[var(--osteria-border)] bg-white">
              <MediaImage
                src={settings.aboutImageUrl}
                alt={`Cozinha artesanal — ${settings.restaurantName}`}
                className="w-full h-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-6 flex flex-col justify-center">
            <p className="text-xs tracking-[0.14em] uppercase text-[var(--osteria-accent)] font-semibold mb-3">
              Sobre a Osteria
            </p>
            <h2
              className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight mb-5"
              style={{ color: 'var(--osteria-ink)', textWrap: 'balance' }}
            >
              {settings.aboutTitle || 'A Tradição da Verdadeira Osteria em Manaus'}
            </h2>
            <p
              className="text-sm sm:text-base leading-relaxed whitespace-pre-line mb-8"
              style={{ color: 'var(--osteria-muted)' }}
            >
              {settings.aboutText}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-[var(--osteria-border)]">
              <div>
                <h3 className="font-display text-xl font-semibold text-[var(--osteria-ink)]">
                  Massas Frescas Artesanais
                </h3>
                <p className="text-xs sm:text-sm text-[var(--osteria-muted)] mt-1.5 leading-relaxed">
                  Produção própria diária do Pastificio e massas recheadas Artigianale com ingredientes selecionados.
                </p>
              </div>
              <div>
                <h3 className="font-display text-xl font-semibold text-[var(--osteria-ink)]">
                  Pizzas Napolitanas
                </h3>
                <p className="text-xs sm:text-sm text-[var(--osteria-muted)] mt-1.5 leading-relaxed">
                  Massa maturada por 48 horas, molho de tomate da casa e combinações clássicas e autorais.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
