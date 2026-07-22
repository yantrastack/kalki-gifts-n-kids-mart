CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'business',
	`email` text,
	`phone` text,
	`address` text,
	`orders` integer DEFAULT 0,
	`spend` real DEFAULT 0,
	`last_order` text,
	`balance` real DEFAULT 0,
	`color` text
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`barcode` text,
	`category` text,
	`brand` text,
	`price` real DEFAULT 0 NOT NULL,
	`cost` real DEFAULT 0 NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL,
	`incoming` integer DEFAULT 0 NOT NULL,
	`damaged` integer DEFAULT 0 NOT NULL,
	`warehouse` text,
	`supplier` text,
	`status` text DEFAULT 'active' NOT NULL,
	`tag` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`warehouse`) REFERENCES `warehouses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`supplier` text,
	`items` integer DEFAULT 0,
	`total` real DEFAULT 0,
	`status` text DEFAULT 'draft',
	`eta` text,
	`created` text
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text,
	`items` integer DEFAULT 0,
	`total` real DEFAULT 0,
	`status` text DEFAULT 'pending',
	`payment` text DEFAULT 'unpaid',
	`date` text
);
--> statement-breakpoint
CREATE TABLE `stock_moves` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`product_id` text,
	`product` text,
	`qty` integer NOT NULL,
	`who` text DEFAULT 'System',
	`warehouse` text,
	`meta` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text,
	`email` text,
	`phone` text,
	`on_time` real DEFAULT 0,
	`last_order` text,
	`spend` real DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`staff` integer DEFAULT 0,
	`capacity` real DEFAULT 0
);
