ALTER TABLE `products` ADD `mrp` real;--> statement-breakpoint
ALTER TABLE `products` ADD `expiry` text;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `free` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `scheme` text;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `expiry` text;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `price` real;--> statement-breakpoint
ALTER TABLE `purchase_order_items` ADD `mrp` real;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `invoice_no` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `invoice_date` text;--> statement-breakpoint
ALTER TABLE `purchase_orders` ADD `entered_date` text;