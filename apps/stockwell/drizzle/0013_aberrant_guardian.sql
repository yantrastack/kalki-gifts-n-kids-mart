PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`invoice_id` text NOT NULL,
	`product_id` text,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`hsn_code` text,
	`qty` integer NOT NULL,
	`unit_price` real NOT NULL,
	`discount` real DEFAULT 0 NOT NULL,
	`gst_rate` real DEFAULT 0 NOT NULL,
	`gst_amount` real DEFAULT 0 NOT NULL,
	`line_total` real NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_invoice_items`("id", "invoice_id", "product_id", "name", "sku", "hsn_code", "qty", "unit_price", "discount", "gst_rate", "gst_amount", "line_total") SELECT "id", "invoice_id", "product_id", "name", "sku", "hsn_code", "qty", "unit_price", "discount", "gst_rate", "gst_amount", "line_total" FROM `invoice_items`;--> statement-breakpoint
DROP TABLE `invoice_items`;--> statement-breakpoint
ALTER TABLE `__new_invoice_items` RENAME TO `invoice_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_purchase_order_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`po_id` text NOT NULL,
	`product_id` text,
	`product` text,
	`sku` text,
	`qty` integer DEFAULT 0 NOT NULL,
	`received` integer DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`is_new` integer DEFAULT 0 NOT NULL,
	`free` integer DEFAULT 0 NOT NULL,
	`scheme` text,
	`expiry` text,
	`price` real,
	`mrp` real,
	`batch_no` text,
	FOREIGN KEY (`po_id`) REFERENCES `purchase_orders`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_purchase_order_items`("id", "po_id", "product_id", "product", "sku", "qty", "received", "cost", "is_new", "free", "scheme", "expiry", "price", "mrp", "batch_no") SELECT "id", "po_id", "product_id", "product", "sku", "qty", "received", "cost", "is_new", "free", "scheme", "expiry", "price", "mrp", "batch_no" FROM `purchase_order_items`;--> statement-breakpoint
DROP TABLE `purchase_order_items`;--> statement-breakpoint
ALTER TABLE `__new_purchase_order_items` RENAME TO `purchase_order_items`;--> statement-breakpoint
CREATE TABLE `__new_stock_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`product_id` text,
	`product` text,
	`qty` integer NOT NULL,
	`who` text DEFAULT 'System',
	`warehouse` text,
	`meta` text,
	`ref` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_stock_moves`("id", "type", "product_id", "product", "qty", "who", "warehouse", "meta", "ref", "created_at") SELECT "id", "type", "product_id", "product", "qty", "who", "warehouse", "meta", "ref", "created_at" FROM `stock_moves`;--> statement-breakpoint
DROP TABLE `stock_moves`;--> statement-breakpoint
ALTER TABLE `__new_stock_moves` RENAME TO `stock_moves`;