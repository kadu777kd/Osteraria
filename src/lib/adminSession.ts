import {
  DEFAULT_CATEGORY_IMAGE_BY_ID,
  DEFAULT_PRODUCT_IMAGE_BY_ID,
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_GALLERY,
  INITIAL_PRODUCTS,
} from '../data/seedData';
import type {
  Category,
  GalleryItem,
  MediaAsset,
  Order,
  OrderStatus,
  Product,
  SiteSettings,
} from '../types/osteria';

const TOKEN_STORAGE_KEY = 'osteria_admin_token_v1';

export function getStoredAdminToken(): string {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredAdminToken(token: string): void {
  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken();
  return token
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
    : { 'Content-Type': 'application/json' };
}

export async function checkAdminSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/session', {
      headers: authHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean };
    return Boolean(data.authenticated);
  } catch {
    return false;
  }
}

export async function loginAdminWithPassword(password: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    token?: string;
    error?: string;
  };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'Senha incorreta.' };
  }
  if (data.token) {
    setStoredAdminToken(data.token);
  }
  return { ok: true };
}

export async function logoutAdminSession(): Promise<void> {
  setStoredAdminToken('');
  try {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // ignore network errors on logout
  }
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch('/api/admin/change-password', {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!res.ok || !data.ok) {
    return { ok: false, error: data.error || 'Não foi possível alterar a senha.' };
  }
  return { ok: true };
}

export interface PublicCmsPayload {
  publishedSettings: SiteSettings | null;
  categories: Category[] | null;
  products: Product[] | null;
  gallery: GalleryItem[] | null;
}

export async function fetchPublicCmsState(): Promise<PublicCmsPayload | null> {
  try {
    const res = await fetch('/api/cms/public', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as PublicCmsPayload;
    return {
      publishedSettings: data.publishedSettings
        ? { ...DEFAULT_SITE_SETTINGS, ...data.publishedSettings }
        : null,
      categories: data.categories
        ? data.categories
            .map((c) => ({
              ...c,
              imageUrl: c.imageUrl || DEFAULT_CATEGORY_IMAGE_BY_ID[c.id] || '',
            }))
            .sort((a, b) => a.order - b.order)
        : null,
      products: data.products
        ? data.products
            .map((p) => ({
              ...p,
              imageUrl:
                p.imageUrl ||
                DEFAULT_PRODUCT_IMAGE_BY_ID[p.id] ||
                DEFAULT_CATEGORY_IMAGE_BY_ID[p.categoryId] ||
                '',
            }))
            .sort((a, b) => a.order - b.order)
        : null,
      gallery: data.gallery ? data.gallery.sort((a, b) => a.order - b.order) : null,
    };
  } catch {
    return null;
  }
}

export interface AdminCmsState {
  publishedSettings: SiteSettings;
  draftSettings: SiteSettings;
  categories: Category[];
  products: Product[];
  gallery: GalleryItem[];
  media: MediaAsset[];
  orders: Order[];
}

export async function fetchAndSeedAdminCms(): Promise<AdminCmsState> {
  const seedRes = await fetch('/api/cms/seed-if-empty', {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({
      publishedSettings: { ...DEFAULT_SITE_SETTINGS, mode: 'published' },
      draftSettings: { ...DEFAULT_SITE_SETTINGS, mode: 'draft' },
      categories: INITIAL_CATEGORIES,
      products: INITIAL_PRODUCTS,
      gallery: INITIAL_GALLERY,
    }),
  });
  if (!seedRes.ok) {
    throw new Error('Sessão administrativa expirada ou inválida.');
  }
  const data = (await seedRes.json()) as Partial<AdminCmsState>;
  return {
    publishedSettings: { ...DEFAULT_SITE_SETTINGS, ...(data.publishedSettings || {}) },
    draftSettings: { ...DEFAULT_SITE_SETTINGS, ...(data.draftSettings || {}), mode: 'draft' },
    categories: (data.categories || INITIAL_CATEGORIES).sort((a, b) => a.order - b.order),
    products: (data.products || INITIAL_PRODUCTS).sort((a, b) => a.order - b.order),
    gallery: (data.gallery || INITIAL_GALLERY).sort((a, b) => a.order - b.order),
    media: data.media || [],
    orders: data.orders || [],
  };
}

export function notifyCmsUpdated(): void {
  window.dispatchEvent(new CustomEvent('osteria-cms-updated'));
}

export async function saveDraftSettingsServer(settings: SiteSettings): Promise<void> {
  const res = await fetch('/api/cms/draft', {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Erro ao salvar rascunho no servidor.');
}

export async function publishSettingsServer(settings: SiteSettings): Promise<number> {
  const res = await fetch('/api/cms/publish', {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Erro ao publicar configurações.');
  const data = (await res.json()) as { version: number };
  notifyCmsUpdated();
  return data.version;
}

export async function saveCategoriesServer(categories: Category[]): Promise<void> {
  const res = await fetch('/api/cms/categories', {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ categories }),
  });
  if (!res.ok) throw new Error('Erro ao salvar categorias.');
  notifyCmsUpdated();
}

export async function saveProductsServer(products: Product[]): Promise<void> {
  const res = await fetch('/api/cms/products', {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ products }),
  });
  if (!res.ok) throw new Error('Erro ao salvar produtos.');
  notifyCmsUpdated();
}

export async function saveGalleryServer(gallery: GalleryItem[]): Promise<void> {
  const res = await fetch('/api/cms/gallery', {
    method: 'PUT',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ gallery }),
  });
  if (!res.ok) throw new Error('Erro ao salvar galeria.');
  notifyCmsUpdated();
}

export async function saveMediaServer(asset: MediaAsset): Promise<MediaAsset> {
  const res = await fetch('/api/cms/media', {
    method: 'POST',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify(asset),
  });
  if (!res.ok) throw new Error('Erro ao salvar imagem.');
  return (await res.json()) as MediaAsset;
}

export async function deleteMediaServer(id: string): Promise<void> {
  const res = await fetch(`/api/cms/media/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Erro ao excluir imagem.');
}

export async function updateOrderStatusServer(
  orderId: string,
  status: OrderStatus
): Promise<void> {
  const res = await fetch(`/api/cms/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: authHeaders(),
    credentials: 'include',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar status do pedido.');
}

export async function postPublicOrderServer(order: {
  id: string;
  customerName: string;
  notes: string;
  items: { productId: string; name: string; price: number | null; quantity: number }[];
  total: number;
  hasUnpricedItems: boolean;
}): Promise<void> {
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    });
  } catch {
    // non-blocking
  }
}
