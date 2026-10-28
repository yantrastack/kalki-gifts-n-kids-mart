ALTER TABLE `products` ADD `lifecycle` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
-- Hand-appended (not drizzle-kit generated): every row that existed before
-- this migration is backfilled to 'active', since they represent an
-- already-established catalog. Only rows inserted after this statement runs
-- keep the column's 'draft' default. See YAN-75.
UPDATE `products` SET `lifecycle` = 'active' WHERE `lifecycle` = 'draft';--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_norm_unique` ON `products` (UPPER(TRIM("sku")));