import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  DEFAULT_CATEGORY_IMAGE_BY_ID,
  DEFAULT_PRODUCT_IMAGE_BY_ID,
  DEFAULT_SITE_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_GALLERY,
  INITIAL_PRODUCTS,
} from '../data/seedData';
import { deleteMediaServer, postPublicOrderServer, saveMediaServer } from './adminSession';
import type {
  AdminUser,
  CartItem,
  Category,
  GalleryItem,
  MediaAsset,
  Order,
  OrderStatus,
  Product,
  SiteSettings,
} from '../types/osteria';
import { auth, db, handleFirestoreError, OperationType } from './firebase';

export function formatPriceBRL(price: number | null | undefined): string {
  if (price === null || price === undefined || Number.isNaN(price)) {
    return 'Sob consulta';
  }
  return price.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 70) || `item-${Date.now()}`
  );
}

export function generateSafeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function buildWhatsAppLink(whatsappNumber: string, text?: string): string {
  const digits = whatsappNumber.replace(/\D/g, '') || '559282563500';
  if (!text) {
    return `https://wa.me/${digits}`;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppOrderMessage(params: {
  restaurantName: string;
  greeting?: string;
  customerName: string;
  notes: string;
  items: CartItem[];
  total: number;
  hasUnpricedItems: boolean;
}): string {
  const header =
    params.greeting?.trim() || `Olá! Gostaria de fazer um pedido na ${params.restaurantName}.`;
  const lines: string[] = [header, ''];
  if (params.customerName.trim()) {
    lines.push(`Cliente: ${params.customerName.trim()}`);
  }
  lines.push('Meu pedido:');
  for (const item of params.items) {
    const unitLabel =
      item.product.price !== null && item.product.price !== undefined
        ? `${formatPriceBRL(item.product.price * item.quantity)}`
        : 'valor a confirmar';
    lines.push(`- ${item.product.name} — Quantidade ${item.quantity} (${unitLabel})`);
  }
  if (params.notes.trim()) {
    lines.push('');
    lines.push(`Observações: ${params.notes.trim()}`);
  }
  lines.push('');
  lines.push(
    params.hasUnpricedItems
      ? `Total parcial: ${formatPriceBRL(params.total)} (+ itens a confirmar)`
      : `Total: ${formatPriceBRL(params.total)}.`
  );
  lines.push('');
  lines.push('Aguardo a confirmação do restaurante!');
  return lines.join('\n');
}

// --- Client-side image compression for permanent Firestore storage (< 750KB) ---
export async function compressImageToWebP(file: File): Promise<{
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo de imagem.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Arquivo não é uma imagem válida.'));
      img.onload = () => {
        const maxDim = 1200;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas indisponível para otimizar imagem.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/webp', quality);
        // Fallback if browser doesn't encode webp
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }
        while (dataUrl.length > 680000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = dataUrl.startsWith('data:image/webp')
            ? canvas.toDataURL('image/webp', quality)
            : canvas.toDataURL('image/jpeg', quality);
        }
        if (dataUrl.length > 730000) {
          reject(new Error('Imagem muito grande mesmo após compressão. Escolha uma foto menor.'));
          return;
        }
        const mimeType = dataUrl.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
        resolve({ dataUrl, mimeType, sizeBytes: dataUrl.length });
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

// In-memory cache for media:{id} resolution
const mediaCache = new Map<string, string>();

export async function resolveMediaUrl(imageUrl: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('media:')) {
    return imageUrl;
  }
  const mediaId = imageUrl.slice('media:'.length);
  const cached = mediaCache.get(mediaId);
  if (cached) return cached;

  try {
    const apiRes = await fetch(`/api/media/${encodeURIComponent(mediaId)}`);
    if (apiRes.ok) {
      const data = (await apiRes.json()) as MediaAsset;
      if (data.dataUrl) {
        mediaCache.set(mediaId, data.dataUrl);
        return data.dataUrl;
      }
    }
  } catch {
    // fall through to Firestore
  }

  try {
    const snap = await getDoc(doc(db, 'media', mediaId));
    if (snap.exists()) {
      const dataUrl = (snap.data() as MediaAsset).dataUrl;
      mediaCache.set(mediaId, dataUrl);
      return dataUrl;
    }
  } catch (err) {
    console.warn('Erro ao carregar mídia:', err);
  }
  return '';
}

// --- Public Real-Time Subscriptions ---
export function subscribePublishedSettings(
  onData: (settings: SiteSettings) => void
): Unsubscribe {
  const path = 'site_settings/published';
  return onSnapshot(
    doc(db, 'site_settings', 'published'),
    (snap) => {
      if (snap.exists()) {
        onData({ ...DEFAULT_SITE_SETTINGS, ...(snap.data() as Partial<SiteSettings>) });
      } else {
        onData(DEFAULT_SITE_SETTINGS);
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, path)
  );
}

export function subscribePublicCategories(
  onData: (categories: Category[]) => void
): Unsubscribe {
  const q = query(collection(db, 'categories'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(INITIAL_CATEGORIES);
        return;
      }
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<Category, 'id'>;
          return {
            id: d.id,
            ...data,
            imageUrl: data.imageUrl || DEFAULT_CATEGORY_IMAGE_BY_ID[d.id] || '',
          };
        })
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
  );
}

export function subscribePublicProducts(
  onData: (products: Product[]) => void
): Unsubscribe {
  const q = query(collection(db, 'products'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(INITIAL_PRODUCTS);
        return;
      }
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<Product, 'id'>;
          return {
            id: d.id,
            ...data,
            imageUrl:
              data.imageUrl ||
              DEFAULT_PRODUCT_IMAGE_BY_ID[d.id] ||
              DEFAULT_CATEGORY_IMAGE_BY_ID[data.categoryId] ||
              '',
          };
        })
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'products')
  );
}

export function subscribePublicGallery(
  onData: (items: GalleryItem[]) => void
): Unsubscribe {
  const q = query(collection(db, 'gallery'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(INITIAL_GALLERY);
        return;
      }
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'gallery')
  );
}

// --- Public Order Creation ---
export async function createWhatsAppOrder(payload: {
  customerName: string;
  notes: string;
  items: CartItem[];
  total: number;
  hasUnpricedItems: boolean;
}): Promise<string> {
  const orderId = generateSafeId('ord');
  const mappedItems = payload.items.slice(0, 50).map((ci) => ({
    productId: ci.product.id,
    name: ci.product.name,
    price: ci.product.price ?? null,
    quantity: ci.quantity,
  }));

  await postPublicOrderServer({
    id: orderId,
    customerName: payload.customerName.trim().slice(0, 120) || 'Cliente via Site',
    notes: payload.notes.trim().slice(0, 600),
    items: mappedItems,
    total: Number(payload.total.toFixed(2)),
    hasUnpricedItems: payload.hasUnpricedItems,
  });

  const path = `orders/${orderId}`;
  try {
    await setDoc(doc(db, 'orders', orderId), {
      customerName: payload.customerName.trim().slice(0, 120) || 'Cliente via Site',
      notes: payload.notes.trim().slice(0, 600),
      items: mappedItems,
      total: Number(payload.total.toFixed(2)),
      hasUnpricedItems: payload.hasUnpricedItems,
      status: 'whatsapp_sent',
      createdAt: serverTimestamp(),
    });
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

// --- Admin Subscriptions & Seed Bootstrap ---
export async function checkIsUserAdmin(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  if (email.toLowerCase() === 'kadulopes624@gmail.com') return true;
  try {
    const snap = await getDoc(doc(db, 'admins', email.toLowerCase()));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function ensureInitialSeedInFirestore(): Promise<void> {
  try {
    const pubSnap = await getDoc(doc(db, 'site_settings', 'published'));
    const catSnap = await getDocs(collection(db, 'categories'));
    if (pubSnap.exists() && !catSnap.empty) {
      return;
    }

    const batch = writeBatch(db);
    if (!pubSnap.exists()) {
      const { updatedAt: _u1, ...pubData } = DEFAULT_SITE_SETTINGS;
      batch.set(doc(db, 'site_settings', 'published'), {
        ...pubData,
        mode: 'published',
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'site_settings', 'draft'), {
        ...pubData,
        mode: 'draft',
        updatedAt: serverTimestamp(),
      });
    }

    if (catSnap.empty) {
      for (const cat of INITIAL_CATEGORIES) {
        const { id, updatedAt: _u, ...rest } = cat;
        batch.set(doc(db, 'categories', id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      for (const prod of INITIAL_PRODUCTS) {
        const { id, updatedAt: _u, ...rest } = prod;
        batch.set(doc(db, 'products', id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
      for (const gal of INITIAL_GALLERY) {
        const { id, updatedAt: _u, ...rest } = gal;
        batch.set(doc(db, 'gallery', id), {
          ...rest,
          updatedAt: serverTimestamp(),
        });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seed_initial');
  }
}

export function subscribeAdminDraftSettings(
  onData: (settings: SiteSettings) => void
): Unsubscribe {
  return onSnapshot(
    doc(db, 'site_settings', 'draft'),
    (snap) => {
      if (snap.exists()) {
        onData({ ...DEFAULT_SITE_SETTINGS, ...(snap.data() as Partial<SiteSettings>), mode: 'draft' });
      } else {
        onData({ ...DEFAULT_SITE_SETTINGS, mode: 'draft' });
      }
    },
    (error) => handleFirestoreError(error, OperationType.GET, 'site_settings/draft')
  );
}

export function subscribeAllCategoriesAdmin(
  onData: (categories: Category[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'categories'),
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<Category, 'id'>;
          return {
            id: d.id,
            ...data,
            imageUrl: data.imageUrl || DEFAULT_CATEGORY_IMAGE_BY_ID[d.id] || '',
          };
        })
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'categories')
  );
}

export function subscribeAllProductsAdmin(
  onData: (products: Product[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'products'),
    (snap) => {
      const items = snap.docs
        .map((d) => {
          const data = d.data() as Omit<Product, 'id'>;
          return {
            id: d.id,
            ...data,
            imageUrl:
              data.imageUrl ||
              DEFAULT_PRODUCT_IMAGE_BY_ID[d.id] ||
              DEFAULT_CATEGORY_IMAGE_BY_ID[data.categoryId] ||
              '',
          };
        })
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'products')
  );
}

export function subscribeAllGalleryAdmin(
  onData: (items: GalleryItem[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'gallery'),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<GalleryItem, 'id'>) }))
        .sort((a, b) => a.order - b.order);
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'gallery')
  );
}

export function subscribeMediaAdmin(onData: (items: MediaAsset[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'media'),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MediaAsset, 'id'>) }));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'media')
  );
}

export function subscribeOrdersAdmin(onData: (orders: Order[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'orders'),
    (snap) => {
      const items = snap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Omit<Order, 'id'>) }))
        .sort((a, b) => {
          const tA = (a.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          const tB = (b.createdAt as { seconds?: number } | undefined)?.seconds ?? 0;
          return tB - tA;
        });
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'orders')
  );
}

export function subscribeAdminsList(onData: (admins: AdminUser[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'admins'),
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<AdminUser, 'id'>) }));
      onData(items);
    },
    (error) => handleFirestoreError(error, OperationType.LIST, 'admins')
  );
}

// --- Admin Mutations ---
function sanitizeSiteSettingsForWrite(settings: SiteSettings, mode: 'draft' | 'published') {
  return {
    mode,
    restaurantName: (settings.restaurantName || 'Osteria del Nonno').slice(0, 120),
    slogan: (settings.slogan || 'Uma experiência italiana feita com tradição e ingredientes especiais.').slice(0, 300),
    heroHighlight: (settings.heroHighlight || '').slice(0, 240),
    heroCtaMenu: (settings.heroCtaMenu || 'VER CARDÁPIO').slice(0, 60),
    heroCtaWhatsapp: (settings.heroCtaWhatsapp || 'FAZER PEDIDO PELO WHATSAPP').slice(0, 60),
    heroImageUrl: (settings.heroImageUrl || '').slice(0, 1500),
    logoUrl: (settings.logoUrl || '').slice(0, 1500),
    aboutTitle: (settings.aboutTitle || '').slice(0, 120),
    aboutText: (settings.aboutText || '').slice(0, 2000),
    aboutImageUrl: (settings.aboutImageUrl || '').slice(0, 1500),
    address: (settings.address || 'Manaus Plaza Shopping, Manaus - AM').slice(0, 240),
    mapsUrl: (settings.mapsUrl || '').slice(0, 500),
    hoursWeekdays: (settings.hoursWeekdays || '').slice(0, 120),
    hoursSunday: (settings.hoursSunday || '').slice(0, 120),
    whatsappNumber: (settings.whatsappNumber || '559282563500').replace(/\D/g, '').slice(0, 30) || '559282563500',
    whatsappDisplay: (settings.whatsappDisplay || '+55 92 8256-3500').slice(0, 40),
    whatsappGreeting: (settings.whatsappGreeting || '').slice(0, 500),
    instagramHandle: (settings.instagramHandle || '@delnonnobr').slice(0, 60),
    instagramUrl: (settings.instagramUrl || '').slice(0, 300),
    footerText: (settings.footerText || '').slice(0, 300),
    colors: settings.colors,
    fonts: settings.fonts,
    sectionOrder: settings.sectionOrder.slice(0, 12),
    hiddenSections: settings.hiddenSections.slice(0, 12),
    version: Math.max(1, Number(settings.version || 1)),
    updatedAt: serverTimestamp(),
  };
}

export async function saveDraftSettings(settings: SiteSettings): Promise<void> {
  try {
    await setDoc(doc(db, 'site_settings', 'draft'), sanitizeSiteSettingsForWrite(settings, 'draft'));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'site_settings/draft');
  }
}

export async function publishSiteSettings(settings: SiteSettings): Promise<number> {
  const nextVersion = Math.max(1, Number(settings.version || 1) + 1);
  const updated = { ...settings, version: nextVersion };
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'site_settings', 'draft'), sanitizeSiteSettingsForWrite(updated, 'draft'));
    batch.set(doc(db, 'site_settings', 'published'), sanitizeSiteSettingsForWrite(updated, 'published'));
    await batch.commit();
    return nextVersion;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'site_settings/published');
  }
}

export async function saveCategory(category: Omit<Category, 'updatedAt'>): Promise<void> {
  const id = category.id || generateSafeId('cat');
  const path = `categories/${id}`;
  try {
    await setDoc(doc(db, 'categories', id), {
      name: category.name.trim().slice(0, 80),
      slug: slugify(category.slug || category.name),
      description: (category.description || '').slice(0, 400),
      imageUrl: (category.imageUrl || '').slice(0, 1500),
      order: Number(category.order ?? 0),
      active: Boolean(category.active),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCategory(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'categories', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `categories/${id}`);
  }
}

export async function saveProduct(product: Omit<Product, 'updatedAt'>): Promise<void> {
  const id = product.id || generateSafeId('prod');
  const path = `products/${id}`;
  try {
    await setDoc(doc(db, 'products', id), {
      name: product.name.trim().slice(0, 120),
      description: (product.description || '').slice(0, 600),
      price:
        product.price === null || product.price === undefined || Number.isNaN(product.price)
          ? null
          : Number(product.price),
      categoryId: product.categoryId,
      imageUrl: (product.imageUrl || '').slice(0, 1500),
      mediaId: product.mediaId ?? null,
      featured: Boolean(product.featured),
      featuredOrder: Number(product.featuredOrder ?? 99),
      order: Number(product.order ?? 0),
      active: Boolean(product.active),
      available: Boolean(product.available),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'products', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
  }
}

export async function saveGalleryItem(item: Omit<GalleryItem, 'updatedAt'>): Promise<void> {
  const id = item.id || generateSafeId('gal');
  const path = `gallery/${id}`;
  try {
    await setDoc(doc(db, 'gallery', id), {
      title: item.title.trim().slice(0, 120),
      caption: (item.caption || '').slice(0, 400),
      imageUrl: item.imageUrl.slice(0, 1500),
      mediaId: item.mediaId ?? null,
      productId: item.productId ?? null,
      order: Number(item.order ?? 0),
      active: Boolean(item.active),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteGalleryItem(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'gallery', id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `gallery/${id}`);
  }
}

export async function uploadMediaAsset(
  file: File,
  userId?: string | null
): Promise<MediaAsset> {
  const { dataUrl, mimeType, sizeBytes } = await compressImageToWebP(file);
  const id = generateSafeId('media');
  const asset: MediaAsset = {
    id,
    name: file.name.slice(0, 160),
    dataUrl,
    mimeType,
    sizeBytes,
    uploadedBy: userId || 'admin-session',
  };

  await saveMediaServer(asset);
  mediaCache.set(id, dataUrl);

  if (userId) {
    const path = `media/${id}`;
    try {
      await setDoc(doc(db, 'media', id), {
        name: asset.name,
        dataUrl,
        mimeType,
        sizeBytes,
        uploadedBy: userId,
        createdAt: serverTimestamp(),
      });
    } catch {
      // already persisted on server media store
    }
  }
  return asset;
}

export async function deleteMediaAsset(id: string): Promise<void> {
  mediaCache.delete(id);
  await deleteMediaServer(id);
  if (auth.currentUser?.emailVerified) {
    try {
      await deleteDoc(doc(db, 'media', id));
    } catch {
      // ignore Firestore permission issues when only using password admin session
    }
  }
}

export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addAuthorizedAdmin(email: string, addedBy: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const path = `admins/${cleanEmail}`;
  try {
    await setDoc(doc(db, 'admins', cleanEmail), {
      email: cleanEmail,
      role: 'admin',
      addedBy,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function removeAuthorizedAdmin(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  try {
    await deleteDoc(doc(db, 'admins', cleanEmail));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${cleanEmail}`);
  }
}

export async function restoreDefaultCatalogInFirestore(): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const cat of INITIAL_CATEGORIES) {
      const { id, updatedAt: _u, ...rest } = cat;
      batch.set(doc(db, 'categories', id), { ...rest, updatedAt: serverTimestamp() });
    }
    for (const prod of INITIAL_PRODUCTS) {
      const { id, updatedAt: _u, ...rest } = prod;
      batch.set(doc(db, 'products', id), { ...rest, updatedAt: serverTimestamp() });
    }
    for (const gal of INITIAL_GALLERY) {
      const { id, updatedAt: _u, ...rest } = gal;
      batch.set(doc(db, 'gallery', id), { ...rest, updatedAt: serverTimestamp() });
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'restore_defaults');
  }
}
