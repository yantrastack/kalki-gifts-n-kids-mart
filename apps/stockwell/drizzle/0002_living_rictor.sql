CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text,
	`date` text,
	`due` text,
	`subtotal` real DEFAULT 0,
	`tax` real DEFAULT 0,
	`total` real DEFAULT 0,
	`paid` real DEFAULT 0,
	`status` text DEFAULT 'unpaid',
	`method` text,
	`channel` text,
	`items` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `returns` (
	`id` text PRIMARY KEY NOT NULL,
	`customer` text,
	`invoice` text,
	`items` integer DEFAULT 0,
	`total` real DEFAULT 0,
	`reason` text,
	`status` text DEFAULT 'pending',
	`date` text
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
ALTER TABLE `users` ADD `active` integer DEFAULT 1 NOT NULL;