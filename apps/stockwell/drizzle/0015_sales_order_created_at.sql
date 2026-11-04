ALTER TABLE `sales_orders` ADD `created_at` text;--> statement-breakpoint
-- Backfill created_at from the old free-text `date` label (YAN-115). Labels come in
-- two shapes: "Jul 16" (Sales Orders API, seed) and "16 Jul" / "16 Sept" (POS,
-- en-IN), optionally followed by a year. Midday UTC keeps the calendar day the
-- same in every timezone from UTC-11 to UTC+11.
UPDATE `sales_orders` SET `created_at` = printf('%04d-%02d-%02dT12:00:00.000Z', q.y, q.m, q.d)
FROM (
  SELECT
    id,
    CASE lower(CASE WHEN substr(t, 1, 1) GLOB '[A-Za-z]' THEN substr(t, 1, 3)
                    ELSE substr(t, instr(t, ' ') + 1, 3) END)
      WHEN 'jan' THEN 1 WHEN 'feb' THEN 2 WHEN 'mar' THEN 3 WHEN 'apr' THEN 4
      WHEN 'may' THEN 5 WHEN 'jun' THEN 6 WHEN 'jul' THEN 7 WHEN 'aug' THEN 8
      WHEN 'sep' THEN 9 WHEN 'oct' THEN 10 WHEN 'nov' THEN 11 WHEN 'dec' THEN 12
    END AS m,
    CASE WHEN substr(t, 1, 1) GLOB '[A-Za-z]' THEN CAST(substr(t, instr(t, ' ') + 1) AS INTEGER)
         ELSE CAST(t AS INTEGER) END AS d,
    CASE WHEN t GLOB '*[0-9][0-9][0-9][0-9]' THEN CAST(substr(t, -4) AS INTEGER)
         ELSE CAST(strftime('%Y', 'now') AS INTEGER) END AS y
  FROM (SELECT id, trim(`date`) AS t FROM `sales_orders` WHERE `created_at` IS NULL AND `date` IS NOT NULL)
) AS q
WHERE `sales_orders`.`id` = q.id AND q.m IS NOT NULL AND q.d BETWEEN 1 AND 31;--> statement-breakpoint
-- A label without a year that lands in the future belongs to last year.
UPDATE `sales_orders`
SET `created_at` = printf('%04d', CAST(substr(`created_at`, 1, 4) AS INTEGER) - 1) || substr(`created_at`, 5)
WHERE `created_at` LIKE '%T12:00:00.000Z'
  AND trim(`date`) NOT GLOB '*[0-9][0-9][0-9][0-9]'
  AND substr(`created_at`, 1, 10) > date('now');
