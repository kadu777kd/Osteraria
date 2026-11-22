export type SectionKey = 'hero' | 'highlights' | 'menu' | 'about' | 'gallery' | 'contact';

export interface SiteColors {
  background: string;
  surface: string;
  ink: string;
  accent: string;
  gold: string;
}

export interface SiteFonts {
  display: string;
  body: string;
}

export interface SiteSettings {
  mode: 'published' | 'draft';
  restaurantName: string;
  slogan: string;
  heroHighlight: string;
  heroCtaMenu: string;
  heroCtaWhatsapp: string;
  heroImageUrl: string;
  logoUrl: string;
  aboutTitle: string;
  aboutText: string;
  aboutImageUrl: string;
  address: string;
  mapsUrl: string;
  hoursWeekdays: string;
  hoursSunday: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  whatsappGreeting: string;
  instagramHandle: string;
  instagramUrl: string;
  footerText: string;
  colors: SiteColors;
  fonts: SiteFonts;
  sectionOrder: SectionKey[];
  hiddenSections: SectionKey[];
  version: number;
  updatedAt?: unknown;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  order: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number | null;
  categoryId: string;
  imageUrl: string;
  mediaId?: string | null;
  featured: boolean;
  featuredOrder: number;
  order: number;
  active: boolean;
  available: boolean;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  caption: string;
  imageUrl: string;
  mediaId?: string | null;
  productId?: string | null;
  order: number;
  active: boolean;
  updatedAt?: unknown;
}

export interface MediaAsset {
  id: string;
  name: string;
  dataUrl: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt?: unknown;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number | null;
  quantity: number;
}

export type OrderStatus = 'whatsapp_sent' | 'confirmed' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  customerName: string;
  notes?: string;
  items: OrderItem[];
  total: number;
  hasUnpricedItems: boolean;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin';
  addedBy: string;
  createdAt?: unknown;
}

export interface CartItem {
  product: Product;
  quantity: number;
}
