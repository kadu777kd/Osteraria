# Security Specification — Osteria del Nonno

## 1. Data Invariants
1. **Admin Authority**: Only verified administrators (`email_verified == true` and either the bootstrapped owner email `kadulopes624@gmail.com` or an existing document in `/admins/{email}`) can create, update, or delete menu categories, products, gallery items, media uploads, site settings, or admin records.
2. **Draft Isolation**: `/site_settings/draft` is never readable by unauthenticated visitors; only `/site_settings/published` is publicly readable.
3. **Active Item Filtering**: Public `list` and `get` queries on `/categories`, `/products`, and `/gallery` only return documents where `active == true`.
4. **Order Privacy (PII Isolation)**: Public visitors may submit an order (`create` on `/orders/{orderId}`) with strict schema bounds (`status == 'whatsapp_sent'`, `createdAt == request.time`, `items.size() <= 50`), but cannot `get`, `list`, `update`, or `delete` any order document.
5. **Size & Type Bounds**: Every string field has strict `.size()` caps, IDs match `^[a-zA-Z0-9_-]+$`, and `media` payloads are capped below 750KB to respect Firestore document limits.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. Unauthenticated visitor attempting `create` on `/products/p1` -> DENIED (`!isAdmin()`).
2. Unauthenticated visitor attempting `update` on `/site_settings/published` to change WhatsApp number -> DENIED (`!isAdmin()`).
3. Unauthenticated visitor attempting `get` on `/site_settings/draft` -> DENIED (`settingId != 'published'`).
4. Unauthenticated visitor attempting `list` on `/orders` to scrape customer names -> DENIED (`!isAdmin()`).
5. Unauthenticated visitor attempting `get` on `/orders/order_1` -> DENIED (`!isAdmin()`).
6. Unauthenticated visitor creating an order with `status: 'confirmed'` instead of `'whatsapp_sent'` -> DENIED.
7. Unauthenticated visitor creating an order with a shadow field `isPaid: true` -> DENIED (`hasOnly` rejection).
8. Unauthenticated visitor creating an order with `createdAt` spoofed to a past date (`createdAt != request.time`) -> DENIED.
9. Signed-in non-admin user with `email_verified: false` spoofing admin email -> DENIED (`email_verified == true` required).
10. Signed-in non-admin user attempting to self-add to `/admins/{email}` -> DENIED (`!isAdmin()`).
11. Admin or visitor injecting a 2KB document ID into `/products/{productId}` -> DENIED (`isValidId` max 128 chars + regex).
12. Unauthenticated visitor attempting `list` on `/products` without `active == true` constraint -> DENIED (`resource.data.active == true || isAdmin()`).
