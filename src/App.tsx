import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { MessageCircle } from 'lucide-react';
import { AboutSection } from './components/AboutSection';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { CartDrawer } from './components/CartDrawer';
import { ContactSection } from './components/ContactSection';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GallerySection } from './components/GallerySection';
import { HeroSection } from './components/HeroSection';
import { HighlightsSection } from './components/HighlightsSection';
import { MenuSection } from './components/MenuSection';
import { Navbar } from './components/Navbar';
import {
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_GALLERY,
  INITIAL_PRODUCTS,
} from './data/seedData';
import { checkAdminSession, fetchPublicCmsState } from './lib/adminSession';
import { auth, testConnection } from './lib/firebase';
import {
  buildWhatsAppLink,
  checkIsUserAdmin,
  subscribePublicCategories,
  subscribePublicGallery,
  subscribePublicProducts,
  subscribePublishedSettings,
} from './lib/osteriaService';
import type {
  CartItem,
  Category,
  GalleryItem,
  Product,
  SectionKey,
  SiteSettings,
} from './types/osteria';

const CART_STORAGE_KEY = 'osteria_del_nonno_cart_v1';

function AppContent() {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [gallery, setGallery] = useState<GalleryItem[]>(INITIAL_GALLERY);

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (raw) return JSON.parse(raw) as CartItem[];
    } catch {
      // ignore invalid localStorage
    }
    return [];
  });
  const [cartOpen, setCartOpen] = useState(false);
  const [orderFocusKey, setOrderFocusKey] = useState(0);

  // Admin auth & view state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthorizedAdmin, setIsAuthorizedAdmin] = useState(false);
  const [isPasswordAdmin, setIsPasswordAdmin] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);

  const serverOverridesRef = useRef({
    settings: false,
    categories: false,
    products: false,
    gallery: false,
  });

  const loadPublicCmsFromServer = useCallback(async () => {
    const payload = await fetchPublicCmsState();
    if (!payload) return;
    if (payload.publishedSettings) {
      serverOverridesRef.current.settings = true;
      setSettings(payload.publishedSettings);
    }
    if (payload.categories) {
      serverOverridesRef.current.categories = true;
      setCategories(payload.categories);
    }
    if (payload.products) {
      serverOverridesRef.current.products = true;
      setProducts(payload.products);
    }
    if (payload.gallery) {
      serverOverridesRef.current.gallery = true;
      setGallery(payload.gallery);
    }
  }, []);

  // Persist cart in localStorage
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignore storage quota errors
    }
  }, [cart]);

  // Server CMS + Admin session + Firestore startup subscriptions
  useEffect(() => {
    let active = true;
    checkAdminSession().then((ok) => {
      if (active && ok) setIsPasswordAdmin(true);
    });
    loadPublicCmsFromServer();

    const onCmsUpdated = () => {
      loadPublicCmsFromServer();
    };
    window.addEventListener('osteria-cms-updated', onCmsUpdated);

    testConnection();
    const unsubs = [
      subscribePublishedSettings((next) => {
        if (!serverOverridesRef.current.settings) setSettings(next);
      }),
      subscribePublicCategories((next) => {
        if (!serverOverridesRef.current.categories) setCategories(next);
      }),
      subscribePublicProducts((next) => {
        if (!serverOverridesRef.current.products) setProducts(next);
      }),
      subscribePublicGallery((next) => {
        if (!serverOverridesRef.current.gallery) setGallery(next);
      }),
    ];
    return () => {
      active = false;
      window.removeEventListener('osteria-cms-updated', onCmsUpdated);
      unsubs.forEach((u) => u());
    };
  }, [loadPublicCmsFromServer]);

  // Optional Firebase Google Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user && user.emailVerified) {
        const ok = await checkIsUserAdmin(user.email);
        setIsAuthorizedAdmin(ok);
      } else {
        setIsAuthorizedAdmin(false);
      }
    });
    return () => unsub();
  }, []);

  // Keep cart item photos/prices synchronized with live catalog
  useEffect(() => {
    setCart((prev) =>
      prev.map((ci) => {
        const live = products.find((p) => p.id === ci.product.id);
        return live ? { ...ci, product: live } : ci;
      })
    );
  }, [products]);

  // Apply dynamic theme CSS variables from published settings
  useEffect(() => {
    const root = document.documentElement;
    if (settings.colors) {
      root.style.setProperty('--osteria-bg', settings.colors.background || '#FAF6F0');
      root.style.setProperty('--osteria-surface', settings.colors.surface || '#F3ECE2');
      root.style.setProperty('--osteria-ink', settings.colors.ink || '#2A1E17');
      root.style.setProperty('--osteria-accent', settings.colors.accent || '#A64B2A');
      root.style.setProperty('--osteria-gold', settings.colors.gold || '#B88B4A');
    }
    if (settings.fonts) {
      root.style.setProperty(
        '--osteria-font-display',
        `'${settings.fonts.display || 'Cormorant Garamond'}', Georgia, serif`
      );
      root.style.setProperty(
        '--osteria-font-body',
        `'${settings.fonts.body || 'Plus Jakarta Sans'}', system-ui, sans-serif`
      );
    }
    if (settings.restaurantName) {
      document.title = `${settings.restaurantName} — Gastronomia Italiana em Manaus`;
    }
  }, [settings]);

  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setOrderFocusKey((k) => k + 1);
    setCartOpen(true);
  };

  const handleUpdateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const handleRemoveItem = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const cartCount = useMemo(
    () => cart.reduce((acc, item) => acc + item.quantity, 0),
    [cart]
  );

  const isAdminAuthenticated = isPasswordAdmin || Boolean(currentUser && isAuthorizedAdmin);

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      setShowAdminPanel(true);
    } else {
      setLoginModalOpen(true);
    }
  };

  // Render full Admin Dashboard when authenticated and active
  if (showAdminPanel && isAdminAuthenticated) {
    return (
      <AdminDashboard
        user={currentUser}
        publishedSettings={settings}
        onExitAdmin={() => setShowAdminPanel(false)}
        onLogoutAdmin={() => {
          setIsPasswordAdmin(false);
          setIsAuthorizedAdmin(false);
          setShowAdminPanel(false);
        }}
      />
    );
  }

  const orderedSections = (
    settings.sectionOrder?.length
      ? settings.sectionOrder
      : (['hero', 'highlights', 'menu', 'about', 'gallery', 'contact'] as SectionKey[])
  ).filter((sec) => !settings.hiddenSections?.includes(sec));

  const floatingWhatsappHref = buildWhatsAppLink(
    settings.whatsappNumber,
    settings.whatsappGreeting || 'Olá! Gostaria de fazer um pedido na Osteria del Nonno.'
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: 'var(--osteria-bg)', color: 'var(--osteria-ink)' }}
    >
      <Navbar
        settings={settings}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
        onOpenAdmin={handleOpenAdmin}
        isAdminLoggedIn={isAdminAuthenticated}
      />

      <main className="flex-1">
        {orderedSections.map((section) => {
          switch (section) {
            case 'hero':
              return <HeroSection key="hero" settings={settings} />;
            case 'highlights':
              return (
                <HighlightsSection
                  key="highlights"
                  products={products}
                  categories={categories}
                  onAddToCart={handleAddToCart}
                />
              );
            case 'menu':
              return (
                <MenuSection
                  key="menu"
                  categories={categories}
                  products={products}
                  cart={cart}
                  onAddToCart={handleAddToCart}
                  onUpdateQty={handleUpdateQty}
                />
              );
            case 'about':
              return <AboutSection key="about" settings={settings} />;
            case 'gallery':
              return <GallerySection key="gallery" items={gallery} />;
            case 'contact':
              return <ContactSection key="contact" settings={settings} />;
            default:
              return null;
          }
        })}
      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 px-4 sm:px-6 text-xs sm:text-sm"
        style={{
          backgroundColor: 'var(--osteria-bg)',
          borderColor: 'var(--osteria-border)',
          color: 'var(--osteria-muted)',
        }}
      >
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="font-display text-lg font-semibold text-[var(--osteria-ink)]">
              {settings.restaurantName}
            </p>
            <p className="text-xs mt-1">{settings.footerText}</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span>{settings.address}</span>
            <span aria-hidden="true">·</span>
            <a
              href={settings.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[var(--osteria-ink)] underline underline-offset-4"
            >
              {settings.instagramHandle}
            </a>
          </div>
        </div>
      </footer>

      {/* Floating WhatsApp Action */}
      <a
        href={floatingWhatsappHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Fazer pedido pelo WhatsApp"
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-[#1F8A4C] hover:bg-[#197540] text-white shadow-lg transition-transform duration-200 hover:scale-[1.03] text-xs sm:text-sm font-semibold"
      >
        <MessageCircle className="w-5 h-5 shrink-0" />
        <span className="hidden sm:inline">WhatsApp</span>
      </a>

      {/* Slide-Over Cart Drawer */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        settings={settings}
        focusOrderInfoKey={orderFocusKey}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={() => setCart([])}
      />

      {/* Admin Login Modal */}
      <AdminLoginModal
        isOpen={loginModalOpen}
        onClose={() => setLoginModalOpen(false)}
        onAuthenticatedAdmin={() => {
          setIsPasswordAdmin(true);
          setLoginModalOpen(false);
          setShowAdminPanel(true);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}
