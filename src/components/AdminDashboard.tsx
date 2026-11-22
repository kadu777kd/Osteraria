import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut, type User } from 'firebase/auth';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  CheckCircle2,
  ClipboardList,
  Download,
  ExternalLink,
  FolderTree,
  Globe,
  Image as ImageIcon,
  Info,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Palette,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_GALLERY,
  INITIAL_PRODUCTS,
} from '../data/seedData';
import {
  changeAdminPassword,
  fetchAndSeedAdminCms,
  logoutAdminSession,
  publishSettingsServer,
  saveCategoriesServer,
  saveDraftSettingsServer,
  saveGalleryServer,
  saveProductsServer,
  updateOrderStatusServer,
} from '../lib/adminSession';
import { auth } from '../lib/firebase';
import {
  addAuthorizedAdmin,
  deleteCategory,
  deleteGalleryItem,
  deleteMediaAsset,
  deleteProduct,
  ensureInitialSeedInFirestore,
  formatPriceBRL,
  generateSafeId,
  publishSiteSettings,
  removeAuthorizedAdmin,
  restoreDefaultCatalogInFirestore,
  saveCategory,
  saveDraftSettings,
  saveGalleryItem,
  saveProduct,
  slugify,
  subscribeAdminsList,
  updateOrderStatus,
  uploadMediaAsset,
} from '../lib/osteriaService';
import type {
  AdminUser,
  Category,
  GalleryItem,
  MediaAsset,
  Order,
  OrderStatus,
  Product,
  SectionKey,
  SiteSettings,
} from '../types/osteria';
import { MediaImage } from './MediaImage';
import { ImagePickerModal } from './admin/ImagePickerModal';

type AdminTab =
  | 'overview'
  | 'customize'
  | 'menu'
  | 'categories'
  | 'gallery'
  | 'banners'
  | 'orders'
  | 'info'
  | 'whatsapp'
  | 'settings'
  | 'security';

const NAV_ITEMS: { id: AdminTab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'customize', label: 'Personalizar site', icon: Palette },
  { id: 'menu', label: 'Cardápio', icon: UtensilsCrossed },
  { id: 'categories', label: 'Categorias', icon: FolderTree },
  { id: 'gallery', label: 'Galeria de fotos', icon: ImageIcon },
  { id: 'banners', label: 'Banners e destaques', icon: Sparkles },
  { id: 'orders', label: 'Pedidos', icon: ClipboardList },
  { id: 'info', label: 'Informações do restaurante', icon: Info },
  { id: 'whatsapp', label: 'WhatsApp e contatos', icon: MessageCircle },
  { id: 'settings', label: 'Configurações', icon: Settings },
  { id: 'security', label: 'Segurança e acesso', icon: Shield },
];

const SECTION_LABELS: Record<SectionKey, string> = {
  hero: 'Capa Inicial (Hero)',
  highlights: 'Destaques do Cardápio',
  menu: 'Cardápio Digital Completo',
  about: 'Sobre a Osteria',
  gallery: 'Galeria de Fotografias',
  contact: 'Informações, Horários & Contato',
};

const DISPLAY_FONTS = [
  'Cormorant Garamond',
  'Playfair Display',
  'Fraunces',
  'Lora',
];

const BODY_FONTS = ['Plus Jakarta Sans', 'DM Sans', 'Lora'];

interface AdminDashboardProps {
  user?: User | null;
  publishedSettings: SiteSettings;
  onExitAdmin: () => void;
  onLogoutAdmin: () => void;
}

export function AdminDashboard({
  user,
  publishedSettings,
  onExitAdmin,
  onLogoutAdmin,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const hasCloudSync = Boolean(user && user.emailVerified);

  // CMS Admin State
  const [draft, setDraft] = useState<SiteSettings>({ ...publishedSettings, mode: 'draft' });
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [gallery, setGallery] = useState<GalleryItem[]>(INITIAL_GALLERY);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);

  // Feedback
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [seeding, setSeeding] = useState(true);

  // Image Picker Modal
  const [pickerState, setPickerState] = useState<{
    open: boolean;
    currentUrl: string;
    onPick: (url: string, mediaId?: string | null) => void;
  }>({ open: false, currentUrl: '', onPick: () => {} });

  // Menu Editing State
  const [menuSearch, setMenuSearch] = useState('');
  const [menuCatFilter, setMenuCatFilter] = useState('all');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [priceDraftStr, setPriceDraftStr] = useState('');

  // Category Editing State
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Gallery Editing State
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);

  // Security & Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // Media Upload Ref
  const mediaUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  useEffect(() => {
    let active = true;

    fetchAndSeedAdminCms()
      .then((state) => {
        if (!active) return;
        setDraft(state.draftSettings);
        setCategories(state.categories);
        setProducts(state.products);
        setGallery(state.gallery);
        setMediaAssets(state.media);
        setOrders(state.orders);
      })
      .catch((err) => {
        console.error(err);
        if (active) showToast('error', 'Erro ao carregar dados do painel administrativo.');
      })
      .finally(() => {
        if (active) setSeeding(false);
      });

    let unsubAdmins: (() => void) | undefined;
    if (hasCloudSync) {
      ensureInitialSeedInFirestore().catch(() => {
        // non-blocking
      });
      unsubAdmins = subscribeAdminsList(setAdmins);
    }

    return () => {
      active = false;
      if (unsubAdmins) unsubAdmins();
    };
  }, [hasCloudSync]);

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      await saveDraftSettingsServer(draft);
      if (hasCloudSync) {
        await saveDraftSettings(draft).catch(() => {});
      }
      showToast('success', 'Rascunho salvo com sucesso.');
    } catch {
      showToast('error', 'Falha ao salvar alterações.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const nextVer = await publishSettingsServer(draft);
      setDraft((prev) => ({ ...prev, version: nextVer }));
      if (hasCloudSync) {
        await publishSiteSettings(draft).catch(() => {});
      }
      showToast('success', `Alterações publicadas no site público (versão ${nextVer}).`);
    } catch {
      showToast('error', 'Falha ao publicar alterações no site.');
    } finally {
      setPublishing(false);
    }
  };

  const persistProduct = async (prod: Product) => {
    const exists = products.some((p) => p.id === prod.id);
    const next = (exists
      ? products.map((p) => (p.id === prod.id ? prod : p))
      : [...products, prod]
    ).sort((a, b) => a.order - b.order);
    setProducts(next);
    await saveProductsServer(next);
    if (hasCloudSync) {
      await saveProduct(prod).catch(() => {});
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const next = products.filter((p) => p.id !== id);
    setProducts(next);
    await saveProductsServer(next);
    if (hasCloudSync) {
      await deleteProduct(id).catch(() => {});
    }
  };

  const persistCategory = async (cat: Category) => {
    const exists = categories.some((c) => c.id === cat.id);
    const next = (exists
      ? categories.map((c) => (c.id === cat.id ? cat : c))
      : [...categories, cat]
    ).sort((a, b) => a.order - b.order);
    setCategories(next);
    await saveCategoriesServer(next);
    if (hasCloudSync) {
      await saveCategory(cat).catch(() => {});
    }
  };

  const handleDeleteCategory = async (id: string) => {
    const next = categories.filter((c) => c.id !== id);
    setCategories(next);
    await saveCategoriesServer(next);
    if (hasCloudSync) {
      await deleteCategory(id).catch(() => {});
    }
  };

  const persistGalleryItem = async (item: GalleryItem) => {
    const exists = gallery.some((g) => g.id === item.id);
    const next = (exists
      ? gallery.map((g) => (g.id === item.id ? item : g))
      : [...gallery, item]
    ).sort((a, b) => a.order - b.order);
    setGallery(next);
    await saveGalleryServer(next);
    if (hasCloudSync) {
      await saveGalleryItem(item).catch(() => {});
    }
  };

  const handleDeleteGalleryItem = async (id: string) => {
    const next = gallery.filter((g) => g.id !== id);
    setGallery(next);
    await saveGalleryServer(next);
    if (hasCloudSync) {
      await deleteGalleryItem(id).catch(() => {});
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    await updateOrderStatusServer(orderId, status);
    if (hasCloudSync) {
      await updateOrderStatus(orderId, status).catch(() => {});
    }
    showToast('success', 'Status do pedido atualizado.');
  };

  const handleAdminLogout = async () => {
    await logoutAdminSession();
    if (auth.currentUser) {
      await signOut(auth).catch(() => {});
    }
    onLogoutAdmin();
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast('error', 'Preencha todos os campos de senha.');
      return;
    }
    if (newPassword.trim().length < 4) {
      showToast('error', 'A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('error', 'A confirmação da nova senha não confere.');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await changeAdminPassword(currentPassword, newPassword);
      if (!res.ok) {
        showToast('error', res.error || 'Não foi possível alterar a senha.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('success', 'Senha de administrador alterada com sucesso.');
    } catch {
      showToast('error', 'Erro de conexão ao alterar a senha.');
    } finally {
      setChangingPassword(false);
    }
  };

  // --- Menu Helpers ---
  const openNewProductModal = () => {
    const firstCat = categories[0]?.id || 'pizza-dell-osteria';
    setEditingProduct({
      id: generateSafeId('prod'),
      name: '',
      description: '',
      price: null,
      categoryId: firstCat,
      imageUrl: '',
      mediaId: null,
      featured: false,
      featuredOrder: 99,
      order: products.length + 1,
      active: true,
      available: true,
    });
    setPriceDraftStr('');
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct({ ...prod });
    setPriceDraftStr(
      prod.price !== null && prod.price !== undefined ? String(prod.price) : ''
    );
  };

  const handleSaveProductModal = async () => {
    if (!editingProduct || !editingProduct.name.trim()) {
      showToast('error', 'Informe o nome do prato.');
      return;
    }
    const parsedPrice =
      priceDraftStr.trim() === ''
        ? null
        : Number(priceDraftStr.replace(',', '.'));
    if (parsedPrice !== null && (Number.isNaN(parsedPrice) || parsedPrice < 0)) {
      showToast('error', 'Preço inválido. Deixe vazio para "Sob consulta" ou informe um número.');
      return;
    }
    try {
      await persistProduct({ ...editingProduct, price: parsedPrice });
      setEditingProduct(null);
      showToast('success', 'Prato salvo no cardápio e atualizado no site.');
    } catch {
      showToast('error', 'Erro ao salvar prato.');
    }
  };

  const handleMoveProductOrder = async (prod: Product, direction: -1 | 1) => {
    const sameCat = products
      .filter((p) => p.categoryId === prod.categoryId)
      .sort((a, b) => a.order - b.order);
    const idx = sameCat.findIndex((p) => p.id === prod.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= sameCat.length) return;
    const other = sameCat[swapIdx];
    const updatedA = { ...prod, order: other.order };
    const updatedB = { ...other, order: prod.order };
    const next = products
      .map((p) => (p.id === updatedA.id ? updatedA : p.id === updatedB.id ? updatedB : p))
      .sort((a, b) => a.order - b.order);
    setProducts(next);
    try {
      await saveProductsServer(next);
      if (hasCloudSync) {
        await Promise.all([saveProduct(updatedA), saveProduct(updatedB)]).catch(() => {});
      }
    } catch {
      showToast('error', 'Erro ao reordenar prato.');
    }
  };

  // --- Category Helpers ---
  const handleSaveCategoryModal = async () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      showToast('error', 'Informe o nome da categoria.');
      return;
    }
    try {
      await persistCategory({
        ...editingCategory,
        slug: slugify(editingCategory.slug || editingCategory.name),
      });
      setEditingCategory(null);
      showToast('success', 'Categoria salva com sucesso.');
    } catch {
      showToast('error', 'Erro ao salvar categoria.');
    }
  };

  // --- Gallery Helpers ---
  const handleSaveGalleryModal = async () => {
    if (!editingGallery || !editingGallery.title.trim() || !editingGallery.imageUrl.trim()) {
      showToast('error', 'Informe o título e selecione uma fotografia.');
      return;
    }
    try {
      await persistGalleryItem(editingGallery);
      setEditingGallery(null);
      showToast('success', 'Item da galeria salvo e atualizado no site.');
    } catch {
      showToast('error', 'Erro ao salvar item da galeria.');
    }
  };

  const handleDirectMediaUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingMedia(true);
    try {
      const uploaded: MediaAsset[] = [];
      for (const file of Array.from(files)) {
        const asset = await uploadMediaAsset(file, user?.uid ?? null);
        uploaded.push(asset);
      }
      setMediaAssets((prev) => [...uploaded, ...prev]);
      showToast('success', 'Fotografia enviada e salva permanentemente na biblioteca.');
    } catch (err: unknown) {
      showToast('error', err instanceof Error ? err.message : 'Falha ao enviar imagem.');
    } finally {
      setUploadingMedia(false);
    }
  };

  // --- Section Order Helpers ---
  const moveSectionOrder = (section: SectionKey, dir: -1 | 1) => {
    const order = [...draft.sectionOrder];
    const idx = order.indexOf(section);
    const target = idx + dir;
    if (idx === -1 || target < 0 || target >= order.length) return;
    [order[idx], order[target]] = [order[target], order[idx]];
    setDraft((prev) => ({ ...prev, sectionOrder: order }));
  };

  const toggleSectionVisibility = (section: SectionKey) => {
    setDraft((prev) => {
      const hidden = prev.hiddenSections.includes(section)
        ? prev.hiddenSections.filter((s) => s !== section)
        : [...prev.hiddenSections, section];
      return { ...prev, hiddenSections: hidden };
    });
  };

  const filteredProducts = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return products
      .filter((p) => (menuCatFilter === 'all' ? true : p.categoryId === menuCatFilter))
      .filter((p) =>
        !q ? true : p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)
      )
      .sort((a, b) => a.order - b.order);
  }, [products, menuCatFilter, menuSearch]);

  const featuredProducts = useMemo(
    () =>
      products
        .filter((p) => p.featured)
        .sort((a, b) => a.featuredOrder - b.featuredOrder),
    [products]
  );

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const handleExportBackup = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      settings: draft,
      categories,
      products,
      gallery,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `osteria-del-nonno-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#F5F1EB] text-[#2A1E17] flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#2A1E17]/10 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileNavOpen((prev) => !prev)}
            className="lg:hidden w-10 h-10 rounded-lg border border-[#2A1E17]/15 flex items-center justify-center cursor-pointer"
            aria-label="Abrir menu do painel"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-semibold text-[#2A1E17] truncate">
              Painel Administrativo · {draft.restaurantName}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <button
            type="button"
            disabled={savingDraft}
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg border border-[#2A1E17]/20 bg-white text-xs sm:text-sm font-medium text-[#2A1E17] hover:bg-[#FAF6F0] cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Save className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">
              {savingDraft ? 'Salvando...' : 'Salvar alterações'}
            </span>
            <span className="sm:hidden">Salvar</span>
          </button>

          <button
            type="button"
            disabled={publishing}
            onClick={handlePublish}
            className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg bg-[#A64B2A] text-white text-xs sm:text-sm font-semibold hover:opacity-95 cursor-pointer disabled:opacity-60 whitespace-nowrap"
          >
            <Globe className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">
              {publishing ? 'Publicando...' : 'Publicar no site'}
            </span>
            <span className="sm:hidden">Publicar</span>
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-[#6C5B4F] hover:text-[#2A1E17] hover:bg-[#F3ECE2] cursor-pointer whitespace-nowrap"
            title="Voltar ao site público"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden md:inline">Ver site</span>
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm bg-[#2A1E17] text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 text-sm">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <X className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-white/60 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex-1 flex relative">
        {/* Sidebar Navigation */}
        <aside
          className={`${
            mobileNavOpen ? 'fixed inset-y-0 left-0 z-40 w-72 shadow-2xl pt-4' : 'hidden'
          } lg:block lg:w-64 lg:shrink-0 bg-white border-r border-[#2A1E17]/10 flex flex-col justify-between`}
        >
          <nav className="p-3 space-y-1 overflow-y-auto">
            {mobileNavOpen && (
              <div className="flex items-center justify-between px-3 pb-3 mb-2 border-b border-[#2A1E17]/10 lg:hidden">
                <span className="font-display text-xl font-semibold">Menu do Painel</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[#F3ECE2]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileNavOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#A64B2A] text-white'
                      : 'text-[#6C5B4F] hover:bg-[#FAF6F0] hover:text-[#2A1E17]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-[#2A1E17]/10 space-y-3">
            <div className="text-xs text-[#6C5B4F] truncate">
              Sessão:{' '}
              <strong className="text-[#2A1E17]">
                {user?.email || 'Administrador'}
              </strong>
            </div>
            <button
              type="button"
              onClick={handleAdminLogout}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-[#2A1E17]/15 text-xs font-semibold text-[#2A1E17] hover:bg-[#FAF6F0] cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair da conta</span>
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-6xl w-full mx-auto space-y-6 overflow-x-hidden">
          {seeding && (
            <div className="bg-white rounded-xl border border-[#2A1E17]/10 p-4 text-sm text-[#6C5B4F]">
              Sincronizando dados com o banco de dados...
            </div>
          )}

          {/* 1. VISÃO GERAL */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Visão Geral</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Resumo em tempo real da Osteria del Nonno. Alterações no cardápio, categorias e galeria são refletidas automaticamente no site.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5">
                  <p className="text-xs text-[#6C5B4F]">Pratos no Cardápio</p>
                  <p className="font-display text-3xl font-semibold mt-1 tabular-nums">
                    {products.length}
                  </p>
                  <p className="text-xs text-[#6C5B4F] mt-1 tabular-nums">
                    {products.filter((p) => p.active && p.available).length} disponíveis
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5">
                  <p className="text-xs text-[#6C5B4F]">Categorias</p>
                  <p className="font-display text-3xl font-semibold mt-1 tabular-nums">
                    {categories.length}
                  </p>
                  <p className="text-xs text-[#6C5B4F] mt-1 tabular-nums">
                    {categories.filter((c) => c.active).length} ativas
                  </p>
                </div>
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5">
                  <p className="text-xs text-[#6C5B4F]">Destaques &amp; Galeria</p>
                  <p className="font-display text-3xl font-semibold mt-1 tabular-nums">
                    {featuredProducts.length} / {gallery.length}
                  </p>
                  <p className="text-xs text-[#6C5B4F] mt-1">Destaques e fotos</p>
                </div>
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5">
                  <p className="text-xs text-[#6C5B4F]">Pedidos WhatsApp</p>
                  <p className="font-display text-3xl font-semibold mt-1 tabular-nums">
                    {orders.length}
                  </p>
                  <p className="text-xs text-[#6C5B4F] mt-1 tabular-nums">
                    Versão publicada v{publishedSettings.version}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Ações Rápidas</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('menu');
                        openNewProductModal();
                      }}
                      className="py-3 px-4 rounded-xl bg-[#A64B2A] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Novo prato</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('gallery')}
                      className="py-3 px-4 rounded-xl border border-[#2A1E17]/15 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#FAF6F0] cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Enviar fotos</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('customize')}
                      className="py-3 px-4 rounded-xl border border-[#2A1E17]/15 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#FAF6F0] cursor-pointer"
                    >
                      <Palette className="w-4 h-4" />
                      <span>Personalizar site</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('whatsapp')}
                      className="py-3 px-4 rounded-xl border border-[#2A1E17]/15 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-[#FAF6F0] cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Configurar WhatsApp</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-3">
                  <h3 className="font-display text-2xl font-semibold">Pratos Sem Preço Definido</h3>
                  <p className="text-xs text-[#6C5B4F]">
                    Estes itens estão marcados como “Sob consulta” até você definir o preço oficial:
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {products.filter((p) => p.price === null || p.price === undefined).length === 0 ? (
                      <p className="text-xs text-emerald-700 font-medium">
                        Todos os pratos possuem preço cadastrado.
                      </p>
                    ) : (
                      products
                        .filter((p) => p.price === null || p.price === undefined)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between py-2 px-3 rounded-lg bg-[#FAF6F0] text-xs"
                          >
                            <span className="font-medium">{p.name}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('menu');
                                openEditProductModal(p);
                              }}
                              className="text-[#A64B2A] font-semibold hover:underline cursor-pointer"
                            >
                              Definir preço
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. PERSONALIZAR SITE */}
          {activeTab === 'customize' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-semibold">Personalizar Site</h2>
                  <p className="text-sm text-[#6C5B4F] mt-1">
                    Controle logotipo, textos, cores, fontes, ordem das seções e rodapé. Clique em “Salvar alterações” para rascunho ou “Publicar no site” para ir ao ar.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Identity & Hero Texts */}
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Identidade &amp; Capa</h3>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Nome do restaurante</label>
                    <input
                      type="text"
                      value={draft.restaurantName}
                      onChange={(e) => setDraft({ ...draft, restaurantName: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Frase principal (Slogan)</label>
                    <textarea
                      rows={2}
                      value={draft.slogan}
                      onChange={(e) => setDraft({ ...draft, slogan: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Destaque da capa</label>
                    <textarea
                      rows={2}
                      value={draft.heroHighlight}
                      onChange={(e) => setDraft({ ...draft, heroHighlight: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">Botão Cardápio</label>
                      <input
                        type="text"
                        value={draft.heroCtaMenu}
                        onChange={(e) => setDraft({ ...draft, heroCtaMenu: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Botão WhatsApp</label>
                      <input
                        type="text"
                        value={draft.heroCtaWhatsapp}
                        onChange={(e) => setDraft({ ...draft, heroCtaWhatsapp: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#2A1E17]/10">
                    <div>
                      <p className="text-xs font-semibold">Logotipo (opcional)</p>
                      <p className="text-[11px] text-[#6C5B4F]">Exibido ao lado do nome no topo</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPickerState({
                          open: true,
                          currentUrl: draft.logoUrl,
                          onPick: (url) => setDraft((prev) => ({ ...prev, logoUrl: url })),
                        })
                      }
                      className="px-3.5 py-2 rounded-lg border border-[#2A1E17]/20 text-xs font-semibold hover:bg-[#FAF6F0] cursor-pointer"
                    >
                      {draft.logoUrl ? 'Trocar logo' : 'Escolher logo'}
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Texto do rodapé</label>
                    <input
                      type="text"
                      value={draft.footerText}
                      onChange={(e) => setDraft({ ...draft, footerText: e.target.value })}
                      className="w-full px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                </div>

                {/* Colors, Fonts & Section Order */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                    <h3 className="font-display text-2xl font-semibold">Cores &amp; Tipografia</h3>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(
                        [
                          ['background', 'Fundo Creme'],
                          ['surface', 'Superfície Bege'],
                          ['ink', 'Marrom Escuro'],
                          ['accent', 'Terracota'],
                          ['gold', 'Dourado'],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="block text-xs font-medium space-y-1">
                          <span>{label}</span>
                          <div className="flex items-center gap-2 border border-[#2A1E17]/15 rounded-lg p-1.5">
                            <input
                              type="color"
                              value={draft.colors[key]}
                              onChange={(e) =>
                                setDraft({
                                  ...draft,
                                  colors: { ...draft.colors, [key]: e.target.value },
                                })
                              }
                              className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                            />
                            <span className="text-[11px] font-mono uppercase">
                              {draft.colors[key]}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fonte dos Títulos</label>
                        <select
                          value={draft.fonts.display}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              fonts: { ...draft.fonts, display: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#2A1E17]/15 text-sm bg-white"
                        >
                          {DISPLAY_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Fonte das Descrições</label>
                        <select
                          value={draft.fonts.body}
                          onChange={(e) =>
                            setDraft({
                              ...draft,
                              fonts: { ...draft.fonts, body: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg border border-[#2A1E17]/15 text-sm bg-white"
                        >
                          {BODY_FONTS.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-3">
                    <h3 className="font-display text-2xl font-semibold">
                      Ordem e Visibilidade das Seções
                    </h3>
                    <div className="space-y-2">
                      {draft.sectionOrder.map((sec, idx) => {
                        const hidden = draft.hiddenSections.includes(sec);
                        return (
                          <div
                            key={sec}
                            className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#2A1E17]/10"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={!hidden}
                                onChange={() => toggleSectionVisibility(sec)}
                                className="w-4 h-4 accent-[#A64B2A] cursor-pointer"
                                aria-label={`Exibir ${SECTION_LABELS[sec]}`}
                              />
                              <span
                                className={`text-sm font-medium truncate ${
                                  hidden ? 'line-through text-[#6C5B4F]' : ''
                                }`}
                              >
                                {SECTION_LABELS[sec]}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                disabled={idx === 0}
                                onClick={() => moveSectionOrder(sec, -1)}
                                className="p-1.5 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
                                aria-label="Mover para cima"
                              >
                                <ArrowUp className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={idx === draft.sectionOrder.length - 1}
                                onClick={() => moveSectionOrder(sec, 1)}
                                className="p-1.5 rounded hover:bg-white disabled:opacity-30 cursor-pointer"
                                aria-label="Mover para baixo"
                              >
                                <ArrowDown className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. CARDÁPIO */}
          {activeTab === 'menu' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-semibold">Gerenciar Cardápio</h2>
                  <p className="text-sm text-[#6C5B4F] mt-1">
                    Adicione pratos, altere preços, edite descrições, troque fotos e controle disponibilidade.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A64B2A] text-white text-sm font-semibold cursor-pointer self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Novo Prato</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6C5B4F]" />
                  <input
                    type="search"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Buscar prato no cardápio..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-[#2A1E17]/15 text-sm"
                  />
                </div>
                <select
                  value={menuCatFilter}
                  onChange={(e) => setMenuCatFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-white border border-[#2A1E17]/15 text-sm"
                >
                  <option value="all">Todas as categorias ({products.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredProducts.map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white rounded-2xl border border-[#2A1E17]/10 p-4 flex gap-4 items-start"
                  >
                    <div className="w-24 h-24 rounded-xl overflow-hidden shrink-0 bg-[#F3ECE2]">
                      <MediaImage
                        src={prod.imageUrl}
                        alt={prod.name}
                        fallbackLabel={prod.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-display text-lg font-semibold leading-tight truncate">
                          {prod.name}
                        </h3>
                        <span className="text-sm font-semibold tabular-nums shrink-0 text-[#A64B2A]">
                          {formatPriceBRL(prod.price)}
                        </span>
                      </div>

                      <p className="text-xs text-[#6C5B4F]">
                        {categoryNameMap.get(prod.categoryId) || prod.categoryId}
                        {prod.featured ? ' · Em Destaque' : ''}
                        {!prod.active ? ' · Oculto' : !prod.available ? ' · Indisponível' : ''}
                      </p>

                      {prod.description && (
                        <p className="text-xs text-[#6C5B4F] line-clamp-2">{prod.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => openEditProductModal(prod)}
                          className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] border border-[#2A1E17]/15 text-xs font-semibold hover:bg-[#F3ECE2] cursor-pointer"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => persistProduct({ ...prod, available: !prod.available })}
                          className="px-2.5 py-1.5 rounded-lg border border-[#2A1E17]/15 text-xs font-medium cursor-pointer hover:bg-[#FAF6F0]"
                        >
                          {prod.available ? 'Pausar' : 'Disponibilizar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveProductOrder(prod, -1)}
                          className="p-1.5 rounded-lg border border-[#2A1E17]/15 hover:bg-[#FAF6F0] cursor-pointer"
                          title="Subir posição"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveProductOrder(prod, 1)}
                          className="p-1.5 rounded-lg border border-[#2A1E17]/15 hover:bg-[#FAF6F0] cursor-pointer"
                          title="Descer posição"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await handleDeleteProduct(prod.id);
                            showToast('success', `${prod.name} excluído do cardápio.`);
                          }}
                          className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 cursor-pointer ml-auto"
                          title="Excluir prato"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. CATEGORIAS */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-semibold">Categorias</h2>
                  <p className="text-sm text-[#6C5B4F] mt-1">
                    Organize, crie ou edite as categorias exibidas no cardápio digital.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setEditingCategory({
                      id: generateSafeId('cat'),
                      name: '',
                      slug: '',
                      description: '',
                      imageUrl: '',
                      order: categories.length + 1,
                      active: true,
                    })
                  }
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A64B2A] text-white text-sm font-semibold cursor-pointer self-start"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nova Categoria</span>
                </button>
              </div>

              <div className="space-y-3">
                {categories.map((cat) => (
                  <div
                    key={cat.id}
                    className="bg-white rounded-2xl border border-[#2A1E17]/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-16 h-12 rounded-lg overflow-hidden bg-[#F3ECE2] shrink-0">
                        <MediaImage
                          src={cat.imageUrl}
                          alt={cat.name}
                          fallbackLabel={cat.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-display text-xl font-semibold truncate">{cat.name}</h3>
                        <p className="text-xs text-[#6C5B4F] truncate">
                          Ordem {cat.order} · {cat.active ? 'Ativa no site' : 'Oculta'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setEditingCategory({ ...cat })}
                        className="px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-xs font-semibold hover:bg-[#FAF6F0] cursor-pointer"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => persistCategory({ ...cat, active: !cat.active })}
                        className="px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-xs font-medium hover:bg-[#FAF6F0] cursor-pointer"
                      >
                        {cat.active ? 'Ocultar' : 'Ativar'}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await handleDeleteCategory(cat.id);
                          showToast('success', 'Categoria removida.');
                        }}
                        className="p-2 rounded-lg text-red-700 hover:bg-red-50 cursor-pointer"
                        aria-label={`Excluir ${cat.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. GALERIA DE FOTOS & BIBLIOTECA */}
          {activeTab === 'gallery' && (
            <div className="space-y-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-3xl font-semibold">
                    Galeria de Fotos &amp; Biblioteca
                  </h2>
                  <p className="text-sm text-[#6C5B4F] mt-1">
                    Envie novas imagens do celular ou computador, organize a galeria pública e associe fotos aos pratos.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5">
                  <input
                    ref={mediaUploadRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleDirectMediaUpload(e.target.files)}
                  />
                  <button
                    type="button"
                    disabled={uploadingMedia}
                    onClick={() => mediaUploadRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer disabled:opacity-60"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{uploadingMedia ? 'Enviando...' : 'Enviar do dispositivo'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingGallery({
                        id: generateSafeId('gal'),
                        title: '',
                        caption: '',
                        imageUrl: '',
                        mediaId: null,
                        productId: null,
                        order: gallery.length + 1,
                        active: true,
                      })
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Adicionar à Galeria Pública</span>
                  </button>
                </div>
              </div>

              {/* Public Gallery Items */}
              <div className="space-y-3">
                <h3 className="font-display text-2xl font-semibold">
                  Fotos Exibidas na Galeria Pública ({gallery.length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gallery.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white rounded-2xl border border-[#2A1E17]/10 overflow-hidden flex flex-col"
                    >
                      <div className="aspect-[4/3] w-full bg-[#F3ECE2]">
                        <MediaImage
                          src={item.imageUrl}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <h4 className="font-display text-lg font-semibold">{item.title}</h4>
                          {item.caption && (
                            <p className="text-xs text-[#6C5B4F] mt-1 line-clamp-2">
                              {item.caption}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-2 border-t border-[#2A1E17]/10">
                          <button
                            type="button"
                            onClick={() => setEditingGallery({ ...item })}
                            className="px-3 py-1.5 rounded-lg border border-[#2A1E17]/15 text-xs font-semibold hover:bg-[#FAF6F0] cursor-pointer"
                          >
                            Editar / Trocar foto
                          </button>
                          <button
                            type="button"
                            onClick={() => persistGalleryItem({ ...item, active: !item.active })}
                            className="px-2.5 py-1.5 rounded-lg border border-[#2A1E17]/15 text-xs cursor-pointer"
                          >
                            {item.active ? 'Ocultar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              await handleDeleteGalleryItem(item.id);
                              showToast('success', 'Foto removida da galeria.');
                            }}
                            className="p-1.5 text-red-700 hover:bg-red-50 rounded-lg ml-auto cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Uploaded Media Library */}
              <div className="space-y-3 pt-4 border-t border-[#2A1E17]/10">
                <h3 className="font-display text-2xl font-semibold">
                  Biblioteca de Arquivos Enviados ({mediaAssets.length})
                </h3>
                {mediaAssets.length === 0 ? (
                  <p className="text-sm text-[#6C5B4F] bg-white rounded-xl border border-[#2A1E17]/10 p-6">
                    Nenhuma foto enviada do dispositivo ainda. Use o botão “Enviar do dispositivo” acima para armazenar imagens permanentemente na biblioteca.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-4">
                    {mediaAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className="bg-white rounded-xl border border-[#2A1E17]/10 overflow-hidden"
                      >
                        <div className="aspect-square w-full bg-[#F3ECE2]">
                          <img
                            src={asset.dataUrl}
                            alt={asset.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="p-2.5 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-medium truncate">{asset.name}</span>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteMediaAsset(asset.id);
                              setMediaAssets((prev) => prev.filter((m) => m.id !== asset.id));
                              showToast('success', 'Arquivo excluído da biblioteca.');
                            }}
                            className="p-1 text-red-700 hover:bg-red-50 rounded cursor-pointer shrink-0"
                            title="Excluir arquivo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 6. BANNERS E DESTAQUES */}
          {activeTab === 'banners' && (
            <div className="space-y-8">
              <div>
                <h2 className="font-display text-3xl font-semibold">Banners e Destaques</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Escolha as imagens principais da capa e da seção Sobre, e controle quais pratos aparecem em “Destaques do Cardápio”.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Banner Principal (Capa)</h3>
                  <div className="aspect-[16/9] rounded-xl overflow-hidden bg-[#F3ECE2]">
                    <MediaImage
                      src={draft.heroImageUrl}
                      alt="Banner principal"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPickerState({
                        open: true,
                        currentUrl: draft.heroImageUrl,
                        onPick: (url) => setDraft((prev) => ({ ...prev, heroImageUrl: url })),
                      })
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
                  >
                    Alterar fotografia do Banner
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Fotografia “Sobre a Osteria”</h3>
                  <div className="aspect-[4/3] rounded-xl overflow-hidden bg-[#F3ECE2]">
                    <MediaImage
                      src={draft.aboutImageUrl}
                      alt="Foto Sobre a Osteria"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setPickerState({
                        open: true,
                        currentUrl: draft.aboutImageUrl,
                        onPick: (url) => setDraft((prev) => ({ ...prev, aboutImageUrl: url })),
                      })
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
                  >
                    Alterar fotografia institucional
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                <h3 className="font-display text-2xl font-semibold">
                  Pratos em Destaque na Página Inicial ({featuredProducts.length})
                </h3>
                <div className="divide-y divide-[#2A1E17]/10">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={prod.featured}
                          onChange={() =>
                            persistProduct({
                              ...prod,
                              featured: !prod.featured,
                              featuredOrder: !prod.featured ? featuredProducts.length + 1 : 99,
                            })
                          }
                          className="w-4 h-4 accent-[#A64B2A] cursor-pointer"
                        />
                        <div>
                          <p className="text-sm font-semibold">{prod.name}</p>
                          <p className="text-xs text-[#6C5B4F]">
                            {categoryNameMap.get(prod.categoryId)} · {formatPriceBRL(prod.price)}
                          </p>
                        </div>
                      </div>

                      {prod.featured && (
                        <div className="flex items-center gap-2">
                          <label className="text-xs text-[#6C5B4F]">Ordem:</label>
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={prod.featuredOrder}
                            onChange={(e) =>
                              persistProduct({
                                ...prod,
                                featuredOrder: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-16 px-2 py-1 rounded border border-[#2A1E17]/15 text-xs tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. PEDIDOS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Pedidos via WhatsApp</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Histórico dos pedidos montados pelos clientes no site antes do envio para o WhatsApp.
                </p>
              </div>

              {orders.length === 0 ? (
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-10 text-center">
                  <p className="font-display text-2xl font-semibold">Nenhum pedido registrado ainda</p>
                  <p className="text-sm text-[#6C5B4F] mt-2">
                    Quando um cliente clicar em “FINALIZAR PEDIDO PELO WHATSAPP”, o resumo aparecerá aqui.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="bg-white rounded-2xl border border-[#2A1E17]/10 p-5 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-xl font-semibold">
                            {ord.customerName}
                          </h3>
                          <p className="text-xs text-[#6C5B4F] tabular-nums">
                            Total: {formatPriceBRL(ord.total)}
                            {ord.hasUnpricedItems ? ' (+ itens a confirmar)' : ''}
                          </p>
                        </div>
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(ord.id, e.target.value as OrderStatus)
                          }
                          className="px-3 py-2 rounded-lg border border-[#2A1E17]/15 text-xs font-semibold bg-[#FAF6F0]"
                        >
                          <option value="whatsapp_sent">Enviado ao WhatsApp</option>
                          <option value="confirmed">Confirmado</option>
                          <option value="completed">Concluído</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </div>

                      <ul className="text-xs text-[#2A1E17] space-y-1 bg-[#FAF6F0] rounded-xl p-3">
                        {ord.items.map((it, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>
                              {it.quantity}× {it.name}
                            </span>
                            <span className="tabular-nums">
                              {it.price !== null ? formatPriceBRL(it.price * it.quantity) : 'A confirmar'}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {ord.notes && (
                        <p className="text-xs text-[#6C5B4F]">
                          <strong>Obs.:</strong> {ord.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 8. INFORMAÇÕES DO RESTAURANTE */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">
                  Informações do Restaurante
                </h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Edite endereço, mapa, horários de funcionamento e história institucional da Osteria.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Endereço completo</label>
                    <input
                      type="text"
                      value={draft.address}
                      onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Link Google Maps</label>
                    <input
                      type="url"
                      value={draft.mapsUrl}
                      onChange={(e) => setDraft({ ...draft, mapsUrl: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Horário Segunda a Sábado
                    </label>
                    <input
                      type="text"
                      value={draft.hoursWeekdays}
                      onChange={(e) => setDraft({ ...draft, hoursWeekdays: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Horário Domingo</label>
                    <input
                      type="text"
                      value={draft.hoursSunday}
                      onChange={(e) => setDraft({ ...draft, hoursSunday: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">Título “Sobre a Osteria”</label>
                  <input
                    type="text"
                    value={draft.aboutTitle}
                    onChange={(e) => setDraft({ ...draft, aboutTitle: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    História e texto institucional
                  </label>
                  <textarea
                    rows={5}
                    value={draft.aboutText}
                    onChange={(e) => setDraft({ ...draft, aboutText: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 9. WHATSAPP E CONTATOS */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">WhatsApp &amp; Contatos</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Configure o número oficial que receberá os pedidos do carrinho e o perfil do Instagram.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Número WhatsApp (apenas dígitos com DDI 55)
                    </label>
                    <input
                      type="text"
                      value={draft.whatsappNumber}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          whatsappNumber: e.target.value.replace(/\D/g, ''),
                        })
                      }
                      placeholder="559282563500"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Telefone para exibição
                    </label>
                    <input
                      type="text"
                      value={draft.whatsappDisplay}
                      onChange={(e) => setDraft({ ...draft, whatsappDisplay: e.target.value })}
                      placeholder="+55 92 8256-3500"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Saudação inicial da mensagem de pedido
                  </label>
                  <input
                    type="text"
                    value={draft.whatsappGreeting}
                    onChange={(e) => setDraft({ ...draft, whatsappGreeting: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1">Instagram (@)</label>
                    <input
                      type="text"
                      value={draft.instagramHandle}
                      onChange={(e) => setDraft({ ...draft, instagramHandle: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">Link do Instagram</label>
                    <input
                      type="url"
                      value={draft.instagramUrl}
                      onChange={(e) => setDraft({ ...draft, instagramUrl: e.target.value })}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <a
                    href={`https://wa.me/${draft.whatsappNumber.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#2A1E17]/20 text-xs font-semibold hover:bg-[#FAF6F0]"
                  >
                    <span>Testar link wa.me/{draft.whatsappNumber}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* 10. CONFIGURAÇÕES */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Configurações &amp; Cache</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Sincronize a versão publicada para todos os visitantes, exporte backup ou restaure padrões.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Publicação &amp; Cache</h3>
                  <p className="text-xs text-[#6C5B4F] leading-relaxed">
                    Versão ativa no site público: <strong>v{publishedSettings.version}</strong>. Ao publicar, o site atualiza em tempo real via Firestore para todos os clientes.
                  </p>
                  <button
                    type="button"
                    onClick={handlePublish}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Forçar atualização e publicar agora</span>
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                  <h3 className="font-display text-2xl font-semibold">Backup &amp; Restauração</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleExportBackup}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#2A1E17]/20 text-xs font-semibold hover:bg-[#FAF6F0] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Exportar backup JSON</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setDraft({ ...DEFAULT_SITE_SETTINGS, mode: 'draft' });
                        setCategories(INITIAL_CATEGORIES);
                        setProducts(INITIAL_PRODUCTS);
                        setGallery(INITIAL_GALLERY);
                        await Promise.all([
                          saveDraftSettingsServer({ ...DEFAULT_SITE_SETTINGS, mode: 'draft' }),
                          saveCategoriesServer(INITIAL_CATEGORIES),
                          saveProductsServer(INITIAL_PRODUCTS),
                          saveGalleryServer(INITIAL_GALLERY),
                        ]);
                        if (hasCloudSync) {
                          await restoreDefaultCatalogInFirestore().catch(() => {});
                        }
                        showToast('success', 'Cardápio inicial restaurado com sucesso.');
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>Restaurar cardápio padrão</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 11. SEGURANÇA E ACESSO */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-3xl font-semibold">Segurança e Acesso</h2>
                <p className="text-sm text-[#6C5B4F] mt-1">
                  Altere a senha de acesso ao painel administrativo ou gerencie sua sessão.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Alterar Senha de Administrador */}
                <form
                  onSubmit={handleChangePassword}
                  className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4"
                >
                  <div className="flex items-center gap-2.5">
                    <KeyRound className="w-5 h-5 text-[#A64B2A]" />
                    <h3 className="font-display text-2xl font-semibold">
                      Alterar Senha de Administrador
                    </h3>
                  </div>
                  <p className="text-xs text-[#6C5B4F]">
                    A nova senha passará a valer imediatamente nos próximos logins do botão Administrador.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold mb-1">Senha atual</label>
                    <input
                      type="password"
                      required
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Digite a senha atual"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Nova senha (mín. 4 caracteres)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1">
                      Confirmar nova senha
                    </label>
                    <input
                      type="password"
                      required
                      minLength={4}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#2A1E17]/15 text-sm"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={changingPassword}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#A64B2A] text-white text-xs font-semibold hover:opacity-95 disabled:opacity-60 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{changingPassword ? 'Atualizando...' : 'Salvar Nova Senha'}</span>
                  </button>
                </form>

                {/* Sessão Atual & Sincronização em Nuvem */}
                <div className="space-y-6">
                  <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                    <h3 className="font-display text-2xl font-semibold">Sessão Atual</h3>
                    <p className="text-sm text-[#6C5B4F]">
                      Conectado como:{' '}
                      <strong className="text-[#2A1E17]">
                        {hasCloudSync && user?.email
                          ? user.email
                          : 'Administrador (acesso por senha)'}
                      </strong>
                    </p>
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sair do Painel Administrativo</span>
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#2A1E17]/10 p-6 space-y-4">
                    <h3 className="font-display text-2xl font-semibold">
                      Sincronização em Nuvem (Opcional)
                    </h3>
                    {!hasCloudSync ? (
                      <>
                        <p className="text-xs text-[#6C5B4F] leading-relaxed">
                          Conecte opcionalmente a conta Google do proprietário ({BOOTSTRAPPED_ADMIN_EMAIL}) para espelhar alterações no Firebase Firestore e gerenciar e-mails autorizados.
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await signInWithPopup(auth, new GoogleAuthProvider());
                              showToast('success', 'Conta Google conectada para sincronização em nuvem.');
                            } catch {
                              showToast('error', 'Não foi possível conectar com o Google.');
                            }
                          }}
                          className="px-4 py-2.5 rounded-xl border border-[#2A1E17]/20 text-xs font-semibold hover:bg-[#FAF6F0] cursor-pointer"
                        >
                          Conectar conta Google ({BOOTSTRAPPED_ADMIN_EMAIL})
                        </button>
                      </>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-xs text-emerald-700 font-medium">
                          Sincronização Firestore ativa para {user?.email}.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="email"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            placeholder="novo.admin@osteria.com"
                            className="flex-1 px-3.5 py-2 rounded-lg border border-[#2A1E17]/15 text-sm"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!newAdminEmail.trim()) return;
                              try {
                                await addAuthorizedAdmin(
                                  newAdminEmail,
                                  user?.email || 'admin'
                                );
                                setNewAdminEmail('');
                                showToast('success', 'Administrador adicionado.');
                              } catch {
                                showToast('error', 'Erro ao adicionar administrador.');
                              }
                            }}
                            className="px-4 py-2 rounded-lg bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
                          >
                            Autorizar
                          </button>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF6F0] text-xs">
                            <span className="font-medium">{BOOTSTRAPPED_ADMIN_EMAIL}</span>
                            <span className="text-[#6C5B4F]">Proprietário</span>
                          </div>
                          {admins
                            .filter((a) => a.email !== BOOTSTRAPPED_ADMIN_EMAIL)
                            .map((adm) => (
                              <div
                                key={adm.id}
                                className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#FAF6F0] text-xs"
                              >
                                <span>{adm.email}</span>
                                <button
                                  type="button"
                                  onClick={() => removeAuthorizedAdmin(adm.email)}
                                  className="text-red-700 font-semibold hover:underline cursor-pointer"
                                >
                                  Remover
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Product Edit Modal */}
      {editingProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg bg-[#FAF6F0] rounded-2xl border border-[#2A1E17]/15 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-5 py-4 bg-white border-b border-[#2A1E17]/10 flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold">Editar Prato</h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-lg hover:bg-[#F3ECE2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-24 h-20 rounded-xl overflow-hidden bg-[#F3ECE2] shrink-0">
                  <MediaImage
                    src={editingProduct.imageUrl}
                    alt={editingProduct.name || 'Prévia'}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPickerState({
                      open: true,
                      currentUrl: editingProduct.imageUrl,
                      onPick: (url, mediaId) =>
                        setEditingProduct((prev) =>
                          prev ? { ...prev, imageUrl: url, mediaId: mediaId ?? null } : prev
                        ),
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
                >
                  Escolher ou Enviar Foto
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Nome do prato</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Categoria</label>
                  <select
                    value={editingProduct.categoryId}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, categoryId: e.target.value })
                    }
                    className="w-full px-3 py-2.5 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Preço em R$ (vazio = Sob consulta)
                  </label>
                  <input
                    type="text"
                    value={priceDraftStr}
                    onChange={(e) => setPriceDraftStr(e.target.value)}
                    placeholder="Ex: 68.00"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#2A1E17]/15 text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs font-medium">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.active}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, active: e.target.checked })
                    }
                    className="accent-[#A64B2A]"
                  />
                  <span>Ativo no cardápio</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.available}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, available: e.target.checked })
                    }
                    className="accent-[#A64B2A]"
                  />
                  <span>Disponível para pedidos</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.featured}
                    onChange={(e) =>
                      setEditingProduct({
                        ...editingProduct,
                        featured: e.target.checked,
                        featuredOrder: e.target.checked ? editingProduct.featuredOrder || 1 : 99,
                      })
                    }
                    className="accent-[#A64B2A]"
                  />
                  <span>Exibir nos Destaques</span>
                </label>
              </div>
            </div>

            <div className="px-5 py-4 bg-white border-t border-[#2A1E17]/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-lg border border-[#2A1E17]/20 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProductModal}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Salvar Prato</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category Edit Modal */}
      {editingCategory && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#FAF6F0] rounded-2xl border border-[#2A1E17]/15 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-white border-b border-[#2A1E17]/10 flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold">Editar Categoria</h3>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="p-1.5 rounded-lg hover:bg-[#F3ECE2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nome da categoria</label>
                <input
                  type="text"
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={editingCategory.description}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Ordem</label>
                  <input
                    type="number"
                    value={editingCategory.order}
                    onChange={(e) =>
                      setEditingCategory({
                        ...editingCategory,
                        order: Number(e.target.value) || 0,
                      })
                    }
                    className="w-24 px-3 py-2 rounded-lg bg-white border border-[#2A1E17]/15 text-sm tabular-nums"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPickerState({
                      open: true,
                      currentUrl: editingCategory.imageUrl,
                      onPick: (url) =>
                        setEditingCategory((prev) => (prev ? { ...prev, imageUrl: url } : prev)),
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer mt-4"
                >
                  Imagem da Categoria
                </button>
              </div>
            </div>

            <div className="px-5 py-4 bg-white border-t border-[#2A1E17]/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
                className="px-4 py-2 rounded-lg border border-[#2A1E17]/20 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveCategoryModal}
                className="px-5 py-2 rounded-lg bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
              >
                Salvar Categoria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Edit Modal */}
      {editingGallery && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#FAF6F0] rounded-2xl border border-[#2A1E17]/15 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-white border-b border-[#2A1E17]/10 flex items-center justify-between">
              <h3 className="font-display text-2xl font-semibold">Item da Galeria</h3>
              <button
                type="button"
                onClick={() => setEditingGallery(null)}
                className="p-1.5 rounded-lg hover:bg-[#F3ECE2] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="aspect-[16/10] w-full rounded-xl overflow-hidden bg-[#F3ECE2]">
                <MediaImage
                  src={editingGallery.imageUrl}
                  alt={editingGallery.title || 'Prévia'}
                  className="w-full h-full object-cover"
                />
              </div>

              <button
                type="button"
                onClick={() =>
                  setPickerState({
                    open: true,
                    currentUrl: editingGallery.imageUrl,
                    onPick: (url, mediaId) =>
                      setEditingGallery((prev) =>
                        prev ? { ...prev, imageUrl: url, mediaId: mediaId ?? null } : prev
                      ),
                  })
                }
                className="w-full py-2.5 rounded-lg bg-[#2A1E17] text-white text-xs font-semibold cursor-pointer"
              >
                Selecionar ou Enviar Fotografia
              </button>

              <div>
                <label className="block text-xs font-semibold mb-1">Título da fotografia</label>
                <input
                  type="text"
                  value={editingGallery.title}
                  onChange={(e) =>
                    setEditingGallery({ ...editingGallery, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Legenda (opcional)</label>
                <textarea
                  rows={2}
                  value={editingGallery.caption}
                  onChange={(e) =>
                    setEditingGallery({ ...editingGallery, caption: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-lg bg-white border border-[#2A1E17]/15 text-sm"
                />
              </div>
            </div>

            <div className="px-5 py-4 bg-white border-t border-[#2A1E17]/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingGallery(null)}
                className="px-4 py-2 rounded-lg border border-[#2A1E17]/20 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveGalleryModal}
                className="px-5 py-2 rounded-lg bg-[#A64B2A] text-white text-xs font-semibold cursor-pointer"
              >
                Salvar na Galeria
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Picker Modal */}
      <ImagePickerModal
        isOpen={pickerState.open}
        onClose={() => setPickerState((prev) => ({ ...prev, open: false }))}
        currentUrl={pickerState.currentUrl}
        mediaAssets={mediaAssets}
        userId={user?.uid ?? null}
        onSelect={pickerState.onPick}
        onAssetUploaded={(asset) => setMediaAssets((prev) => [asset, ...prev])}
      />
    </div>
  );
}
