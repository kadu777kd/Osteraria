import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const AUTH_FILE = path.join(DATA_DIR, 'admin-auth.json');
const CMS_FILE = path.join(DATA_DIR, 'cms-state.json');

interface AuthStore {
  salt: string;
  passwordHash: string;
  sessionSecret: string;
  updatedAt: string;
}

interface CmsState {
  publishedSettings: Record<string, unknown> | null;
  draftSettings: Record<string, unknown> | null;
  categories: Record<string, unknown>[] | null;
  products: Record<string, unknown>[] | null;
  gallery: Record<string, unknown>[] | null;
  media: Record<string, unknown>[];
  orders: Record<string, unknown>[];
}

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function loadOrInitAuthStore(): AuthStore {
  ensureDataDir();
  if (fs.existsSync(AUTH_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8')) as AuthStore;
      if (parsed.salt && parsed.passwordHash && parsed.sessionSecret) {
        return parsed;
      }
    } catch {
      // re-initialize if corrupted
    }
  }

  const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || 'pizzaria2026';
  const salt = crypto.randomBytes(16).toString('hex');
  const store: AuthStore = {
    salt,
    passwordHash: hashPassword(initialPassword, salt),
    sessionSecret: crypto.randomBytes(32).toString('hex'),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf-8');
  return store;
}

function saveAuthStore(store: AuthStore): void {
  ensureDataDir();
  fs.writeFileSync(AUTH_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

function verifyPassword(password: string, store: AuthStore): boolean {
  const candidate = Buffer.from(hashPassword(password, store.salt), 'hex');
  const expected = Buffer.from(store.passwordHash, 'hex');
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

function signSessionToken(secret: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      role: 'admin',
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      nonce: crypto.randomBytes(8).toString('hex'),
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifySessionToken(token: string, secret: string): boolean {
  if (!token || !token.includes('.')) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now();
  } catch {
    return false;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) continue;
    const key = part.slice(0, eqIdx).trim();
    const val = part.slice(eqIdx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  }
  return out;
}

function extractAdminToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice('Bearer '.length).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.osteria_admin_session || '';
}

function loadCmsState(): CmsState {
  ensureDataDir();
  if (fs.existsSync(CMS_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(CMS_FILE, 'utf-8')) as Partial<CmsState>;
      return {
        publishedSettings: parsed.publishedSettings ?? null,
        draftSettings: parsed.draftSettings ?? null,
        categories: parsed.categories ?? null,
        products: parsed.products ?? null,
        gallery: parsed.gallery ?? null,
        media: Array.isArray(parsed.media) ? parsed.media : [],
        orders: Array.isArray(parsed.orders) ? parsed.orders : [],
      };
    } catch {
      // fall through to default
    }
  }
  return {
    publishedSettings: null,
    draftSettings: null,
    categories: null,
    products: null,
    gallery: null,
    media: [],
    orders: [],
  };
}

function saveCmsState(state: CmsState): void {
  ensureDataDir();
  fs.writeFileSync(CMS_FILE, JSON.stringify(state, null, 2), 'utf-8');
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  let authStore = loadOrInitAuthStore();

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const token = extractAdminToken(req);
    if (!verifySessionToken(token, authStore.sessionSecret)) {
      res.status(401).json({ error: 'Não autorizado. Faça login como administrador.' });
      return;
    }
    next();
  };

  // --- Admin Auth Endpoints ---
  app.get('/api/admin/session', (req: Request, res: Response) => {
    const token = extractAdminToken(req);
    const authenticated = verifySessionToken(token, authStore.sessionSecret);
    res.json({ authenticated });
  });

  app.post('/api/admin/login', (req: Request, res: Response) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password) {
      res.status(400).json({ error: 'Informe a senha de administrador.' });
      return;
    }
    if (!verifyPassword(password, authStore)) {
      res.status(401).json({ error: 'Senha incorreta. Tente novamente.' });
      return;
    }
    const token = signSessionToken(authStore.sessionSecret);
    res.setHeader(
      'Set-Cookie',
      `osteria_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`
    );
    res.json({ ok: true, token });
  });

  app.post('/api/admin/logout', (_req: Request, res: Response) => {
    res.setHeader(
      'Set-Cookie',
      'osteria_admin_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    );
    res.json({ ok: true });
  });

  app.post('/api/admin/change-password', requireAdmin, (req: Request, res: Response) => {
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Preencha a senha atual e a nova senha.' });
      return;
    }
    if (newPassword.trim().length < 4) {
      res.status(400).json({ error: 'A nova senha deve ter pelo menos 4 caracteres.' });
      return;
    }
    if (!verifyPassword(currentPassword, authStore)) {
      res.status(401).json({ error: 'A senha atual informada está incorreta.' });
      return;
    }

    const newSalt = crypto.randomBytes(16).toString('hex');
    authStore = {
      ...authStore,
      salt: newSalt,
      passwordHash: hashPassword(newPassword, newSalt),
      updatedAt: new Date().toISOString(),
    };
    saveAuthStore(authStore);
    res.json({ ok: true });
  });

  // --- Public CMS & Order Endpoints ---
  app.get('/api/cms/public', (_req: Request, res: Response) => {
    const state = loadCmsState();
    res.json({
      publishedSettings: state.publishedSettings,
      categories: state.categories,
      products: state.products,
      gallery: state.gallery,
    });
  });

  app.get('/api/media/:id', (req: Request, res: Response) => {
    const state = loadCmsState();
    const found = state.media.find((m) => m.id === req.params.id);
    if (!found) {
      res.status(404).json({ error: 'Mídia não encontrada.' });
      return;
    }
    res.json(found);
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const state = loadCmsState();
    const body = req.body as Record<string, unknown>;
    const order = {
      id: typeof body.id === 'string' ? body.id : `ord-${Date.now().toString(36)}`,
      customerName:
        typeof body.customerName === 'string' && body.customerName.trim()
          ? body.customerName.trim().slice(0, 120)
          : 'Cliente via Site',
      notes: typeof body.notes === 'string' ? body.notes.trim().slice(0, 600) : '',
      items: Array.isArray(body.items) ? body.items.slice(0, 50) : [],
      total: Number(body.total || 0),
      hasUnpricedItems: Boolean(body.hasUnpricedItems),
      status: 'whatsapp_sent',
      createdAt: new Date().toISOString(),
    };
    state.orders = [order, ...state.orders].slice(0, 200);
    saveCmsState(state);
    res.status(201).json(order);
  });

  // --- Protected Admin CMS Endpoints ---
  app.get('/api/cms/admin', requireAdmin, (_req: Request, res: Response) => {
    const state = loadCmsState();
    res.json(state);
  });

  app.post('/api/cms/seed-if-empty', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const body = req.body as Partial<CmsState>;
    let changed = false;
    if (!state.publishedSettings && body.publishedSettings) {
      state.publishedSettings = body.publishedSettings;
      changed = true;
    }
    if (!state.draftSettings && body.draftSettings) {
      state.draftSettings = body.draftSettings;
      changed = true;
    }
    if (!state.categories && Array.isArray(body.categories)) {
      state.categories = body.categories;
      changed = true;
    }
    if (!state.products && Array.isArray(body.products)) {
      state.products = body.products;
      changed = true;
    }
    if (!state.gallery && Array.isArray(body.gallery)) {
      state.gallery = body.gallery;
      changed = true;
    }
    if (changed) saveCmsState(state);
    res.json(state);
  });

  app.put('/api/cms/draft', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    state.draftSettings = { ...(req.body as Record<string, unknown>), mode: 'draft' };
    saveCmsState(state);
    res.json({ ok: true, draftSettings: state.draftSettings });
  });

  app.post('/api/cms/publish', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const incoming = req.body as Record<string, unknown>;
    const nextVersion = Math.max(1, Number(incoming.version || 1) + 1);
    const updated = { ...incoming, version: nextVersion };
    state.draftSettings = { ...updated, mode: 'draft' };
    state.publishedSettings = { ...updated, mode: 'published' };
    saveCmsState(state);
    res.json({ ok: true, version: nextVersion, publishedSettings: state.publishedSettings });
  });

  app.put('/api/cms/categories', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const list = Array.isArray(req.body?.categories)
      ? (req.body.categories as Record<string, unknown>[])
      : [];
    state.categories = list;
    saveCmsState(state);
    res.json({ ok: true });
  });

  app.put('/api/cms/products', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const list = Array.isArray(req.body?.products)
      ? (req.body.products as Record<string, unknown>[])
      : [];
    state.products = list;
    saveCmsState(state);
    res.json({ ok: true });
  });

  app.put('/api/cms/gallery', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const list = Array.isArray(req.body?.gallery)
      ? (req.body.gallery as Record<string, unknown>[])
      : [];
    state.gallery = list;
    saveCmsState(state);
    res.json({ ok: true });
  });

  app.post('/api/cms/media', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const asset = req.body as Record<string, unknown>;
    state.media = [asset, ...state.media.filter((m) => m.id !== asset.id)];
    saveCmsState(state);
    res.status(201).json(asset);
  });

  app.delete('/api/cms/media/:id', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    state.media = state.media.filter((m) => m.id !== req.params.id);
    saveCmsState(state);
    res.json({ ok: true });
  });

  app.patch('/api/cms/orders/:id', requireAdmin, (req: Request, res: Response) => {
    const state = loadCmsState();
    const status = typeof req.body?.status === 'string' ? req.body.status : 'whatsapp_sent';
    state.orders = state.orders.map((o) =>
      o.id === req.params.id ? { ...o, status, updatedAt: new Date().toISOString() } : o
    );
    saveCmsState(state);
    res.json({ ok: true });
  });

  // --- Vite Dev Middleware or Static Prod Serving ---
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProduction =
    process.env.NODE_ENV === 'production' ||
    (process.env.npm_lifecycle_event === 'start' &&
      fs.existsSync(path.join(distDir, 'index.html')));

  if (isProduction) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Osteria del Nonno server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
