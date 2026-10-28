CREATE TABLE `invoice_items` (
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
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `invoices` ADD `sales_order_id` text REFERENCES sales_orders(id);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_sales_order_unique` ON `invoices` (`sales_order_id`);--> statement-breakpoint
ALTER TABLE `stock_moves` ADD `ref` text;