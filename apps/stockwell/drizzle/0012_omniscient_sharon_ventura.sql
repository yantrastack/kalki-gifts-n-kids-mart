CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`direction` text NOT NULL,
	`method` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`reference` text,
	`return_id` text,
	`received_at` text NOT NULL,
	`recorded_by` text,
	`note` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP),
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`return_id`) REFERENCES `returns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `payments_invoice_idx` ON `payments` (`invoice_id`);--> statement-breakpoint
ALTER TABLE `invoices` ADD `customer_id` text REFERENCES customers(id);--> statement-breakpoint
ALTER TABLE `invoices` ADD `issue_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `due_date` text;--> statement-breakpoint
ALTER TABLE `invoices` ADD `terms` text DEFAULT 'immediate' NOT NULL;--> statement-breakpoint
ALTER TABLE `returns` ADD `invoice_id` text REFERENCES invoices(id);--> statement-breakpoint
ALTER TABLE `returns` ADD `credit_note_no` text;--> statement-breakpoint
-- Everything below is hand-appended (drizzle-kit does not generate data
-- migrations). It converts existing rows to the payments model. See YAN-74.
--
-- ISO dates from the old 'Mon DD, YYYY' strings. Strings in any other shape
-- (for example the year-less '28 Oct' that POS wrote before YAN-74) are left
-- null here and filled from the sale's stock move just below.
UPDATE `invoices` SET `issue_date` = substr(`date`, 9, 4) || '-' || (CASE substr(`date`, 1, 3)
  WHEN 'Jan' THEN '01' WHEN 'Feb' THEN '02' WHEN 'Mar' THEN '03' WHEN 'Apr' THEN '04'
  WHEN 'May' THEN '05' WHEN 'Jun' THEN '06' WHEN 'Jul' THEN '07' WHEN 'Aug' THEN '08'
  WHEN 'Sep' THEN '09' WHEN 'Oct' THEN '10' WHEN 'Nov' THEN '11' WHEN 'Dec' THEN '12' END) || '-' || substr(`date`, 5, 2)
WHERE `date` GLOB '[A-Z][a-z][a-z] [0-9][0-9], [0-9][0-9][0-9][0-9]';--> statement-breakpoint
UPDATE `invoices` SET `due_date` = substr(`due`, 9, 4) || '-' || (CASE substr(`due`, 1, 3)
  WHEN 'Jan' THEN '01' WHEN 'Feb' THEN '02' WHEN 'Mar' THEN '03' WHEN 'Apr' THEN '04'
  WHEN 'May' THEN '05' WHEN 'Jun' THEN '06' WHEN 'Jul' THEN '07' WHEN 'Aug' THEN '08'
  WHEN 'Sep' THEN '09' WHEN 'Oct' THEN '10' WHEN 'Nov' THEN '11' WHEN 'Dec' THEN '12' END) || '-' || substr(`due`, 5, 2)
WHERE `due` GLOB '[A-Z][a-z][a-z] [0-9][0-9], [0-9][0-9][0-9][0-9]';--> statement-breakpoint
-- POS invoices made by YAN-73 carry the sale's stock move; use its (UTC) date.
UPDATE `invoices` SET `issue_date` = (
  SELECT substr(MIN(`stock_moves`.`created_at`), 1, 10) FROM `stock_moves` WHERE `stock_moves`.`ref` = `invoices`.`id`
) WHERE `issue_date` IS NULL;--> statement-breakpoint
-- Terms: credit when the due date is after the issue date, and also when the
-- invoice still has an unpaid balance (a customer who owes money is on credit,
-- even if no due date was ever recorded). Everything else was paid at the
-- counter. Immediate invoices carry no due date.
UPDATE `invoices` SET `terms` = CASE
  WHEN `due_date` IS NOT NULL AND `issue_date` IS NOT NULL AND `due_date` > `issue_date` THEN 'credit'
  WHEN COALESCE(`status`, '') != 'void' AND COALESCE(`paid`, 0) < COALESCE(`total`, 0) - 0.005 THEN 'credit'
  ELSE 'immediate' END;--> statement-breakpoint
UPDATE `invoices` SET `due_date` = `issue_date` WHERE `terms` = 'credit' AND `due_date` IS NULL;--> statement-breakpoint
UPDATE `invoices` SET `due_date` = NULL WHERE `terms` = 'immediate';--> statement-breakpoint
-- Link invoices to customers by name. The walk-in placeholder is not a
-- registered customer, so it stays unlinked.
UPDATE `invoices` SET `customer_id` = (
  SELECT `c`.`id` FROM `customers` `c` WHERE LOWER(TRIM(`c`.`name`)) = LOWER(TRIM(`invoices`.`customer`)) ORDER BY `c`.`id` LIMIT 1
) WHERE `customer_id` IS NULL AND LOWER(TRIM(COALESCE(`customer`, ''))) NOT IN ('', 'walk-in customer');--> statement-breakpoint
-- One payment row per invoice that had money recorded against it. The old
-- single `method` string maps onto the five supported methods.
INSERT INTO `payments` (`id`, `invoice_id`, `direction`, `method`, `amount_paise`, `received_at`, `recorded_by`, `note`)
SELECT 'PAY-' || upper(hex(randomblob(5))), `id`, 'payment',
  CASE LOWER(TRIM(COALESCE(`method`, '')))
    WHEN 'cash' THEN 'cash' WHEN 'upi' THEN 'upi' WHEN 'card' THEN 'card'
    WHEN 'neft' THEN 'bank_transfer' WHEN 'rtgs' THEN 'bank_transfer' WHEN 'imps' THEN 'bank_transfer'
    WHEN 'wallet' THEN 'upi' ELSE 'cash' END,
  CAST(ROUND(`paid` * 100) AS INTEGER),
  COALESCE(`issue_date` || 'T00:00:00.000Z', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  'migration',
  CASE LOWER(TRIM(COALESCE(`method`, '')))
    WHEN 'cash' THEN NULL WHEN 'upi' THEN NULL WHEN 'card' THEN NULL
    WHEN 'neft' THEN NULL WHEN 'rtgs' THEN NULL WHEN 'imps' THEN NULL
    WHEN 'wallet' THEN 'migrated: wallet recorded as UPI'
    ELSE 'migrated: payment method unknown' END
FROM `invoices` WHERE COALESCE(`paid`, 0) > 0;--> statement-breakpoint
-- Invoice status is lifecycle only now; paid/partial/unpaid/overdue are derived.
UPDATE `invoices` SET `status` = 'issued' WHERE COALESCE(`status`, '') != 'void';--> statement-breakpoint
-- Returns: link to the invoice when the free-text reference is a real invoice id.
UPDATE `returns` SET `invoice_id` = (
  SELECT `i`.`id` FROM `invoices` `i` WHERE `i`.`id` = `returns`.`invoice`
) WHERE `invoice_id` IS NULL;--> statement-breakpoint
UPDATE `returns` SET `credit_note_no` = 'CN-' || substr(`id`, instr(`id`, '-') + 1) WHERE `credit_note_no` IS NULL;--> statement-breakpoint
-- Returns already marked refunded get a refund row, but only when there is an
-- invoice to attach it to (a refund with no invoice has nothing to link to).
INSERT INTO `payments` (`id`, `invoice_id`, `direction`, `method`, `amount_paise`, `return_id`, `received_at`, `recorded_by`, `note`)
SELECT 'PAY-' || upper(hex(randomblob(5))), `r`.`invoice_id`, 'refund', 'cash',
  CAST(ROUND(`r`.`total` * 100) AS INTEGER), `r`.`id`,
  COALESCE(`i`.`issue_date` || 'T00:00:00.000Z', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  'migration', 'migrated: refund method unknown'
FROM `returns` `r` JOIN `invoices` `i` ON `i`.`id` = `r`.`invoice_id`
WHERE `r`.`status` = 'refunded' AND COALESCE(`r`.`total`, 0) > 0;