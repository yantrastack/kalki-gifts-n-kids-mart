import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const warehouses = sqliteTable('warehouses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  city: text('city'),
  staff: integer('staff').default(0),
  capacity: real('capacity').default(0),
});

export const suppliers = sqliteTable('suppliers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  contact: text('contact'),
  email: text('email'),
  phone: text('phone'),
  onTime: real('on_time').default(0),
  lastOrder: text('last_order'),
  spend: real('spend').default(0),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  sku: text('sku').notNull(),
  barcode: text('barcode'),
  category: text('category'),
  brand: text('brand'),
  price: real('price').notNull().default(0),
  cost: real('cost').notNull().default(0),
  stock: integer('stock').notNull().default(0),
  reserved: integer('reserved').notNull().default(0),
  incoming: integer('incoming').notNull().default(0),
  damaged: integer('damaged').notNull().default(0),
  warehouse: text('warehouse').references(() => warehouses.id),
  supplier: text('supplier'),
  status: text('status').notNull().default('active'),
  tag: text('tag'),
  hsnCode: text('hsn_code'),
  gstRate: real('gst_rate').default(0),
  // Gift-finder attributes (CSV lists; empty = not tagged for gifting)
  giftOccasions: text('gift_occasions'), // e.g. "wedding,birthday"
  giftRecipients: text('gift_recipients'), // e.g. "men,kids"
  giftAgeMin: integer('gift_age_min'),
  giftAgeMax: integer('gift_age_max'),
  giftTypes: text('gift_types'), // e.g. "watch,wallet"
  giftInterests: text('gift_interests'), // e.g. "music,sports"
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export const productMedia = sqliteTable('product_media', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  type: text('type').notNull().default('image'), // "image" | "video"
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

// Engagement events from the storefront "Discover" reels (views/likes/shares/buys).
export const productEvents = sqliteTable('product_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // view | like | unlike | share | buy | open
  sessionId: text('session_id'), // anonymous per-device id, for reach/dedupe
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
export type ProductEvent = typeof productEvents.$inferSelect;

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').default('business'),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  orders: integer('orders').default(0),
  spend: real('spend').default(0),
  lastOrder: text('last_order'),
  balance: real('balance').default(0),
  color: text('color'),
});

export const purchaseOrders = sqliteTable('purchase_orders', {
  id: text('id').primaryKey(),
  supplier: text('supplier'),
  items: integer('items').default(0),
  total: real('total').default(0),
  status: text('status').default('draft'),
  eta: text('eta'),
  created: text('created'),
});

export const salesOrders = sqliteTable('sales_orders', {
  id: text('id').primaryKey(),
  customer: text('customer'),
  items: integer('items').default(0),
  total: real('total').default(0),
  status: text('status').default('pending'),
  payment: text('payment').default('unpaid'),
  date: text('date'),
});

export const stockMoves = sqliteTable('stock_moves', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  productId: text('product_id').references(() => products.id),
  product: text('product'),
  qty: integer('qty').notNull(),
  who: text('who').default('System'),
  warehouse: text('warehouse'),
  meta: text('meta'),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Supplier = typeof suppliers.$inferSelect;
export type Warehouse = typeof warehouses.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type StockMove = typeof stockMoves.$inferSelect;

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('staff'),
  active: integer('active').notNull().default(1),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`),
});
export type User = typeof users.$inferSelect;

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  customer: text('customer'),
  date: text('date'),
  due: text('due'),
  subtotal: real('subtotal').default(0),
  tax: real('tax').default(0),
  total: real('total').default(0),
  paid: real('paid').default(0),
  status: text('status').default('unpaid'),
  method: text('method'),
  channel: text('channel'),
  items: integer('items').default(0),
});

export const returns = sqliteTable('returns', {
  id: text('id').primaryKey(),
  customer: text('customer'),
  invoice: text('invoice'),
  items: integer('items').default(0),
  total: real('total').default(0),
  reason: text('reason'),
  status: text('status').default('pending'),
  date: text('date'),
});

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value'),
});

export type Invoice = typeof invoices.$inferSelect;
export type Return = typeof returns.$inferSelect;
export type Setting = typeof settings.$inferSelect;
