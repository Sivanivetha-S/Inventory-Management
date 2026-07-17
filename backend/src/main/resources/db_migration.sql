-- ═══════════════════════════════════════════════════════════════════════
-- Smart Inventory — Database Migration Script
-- Run this ONCE in MySQL Workbench or CLI against smart_inventory_db
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS guards)
-- ═══════════════════════════════════════════════════════════════════════

USE smart_inventory_db;

-- ── 1. Create damage_records table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS damage_records (
    id            BIGINT        NOT NULL AUTO_INCREMENT,
    admin_id      BIGINT        NOT NULL,
    product_id    BIGINT        NOT NULL,
    product_name  VARCHAR(255)  NOT NULL,
    quantity      INT           NOT NULL,
    reason        VARCHAR(20)   NOT NULL COMMENT 'BROKEN | EXPIRED | DEFECTIVE | OTHER',
    notes         VARCHAR(500)  DEFAULT NULL,
    damage_date   DATE          NOT NULL,
    created_at    DATETIME      DEFAULT NULL,
    PRIMARY KEY (id),
    CONSTRAINT fk_dmg_admin   FOREIGN KEY (admin_id)   REFERENCES admins(id)    ON DELETE CASCADE,
    CONSTRAINT fk_dmg_product FOREIGN KEY (product_id) REFERENCES products(id)  ON DELETE CASCADE,
    INDEX idx_dmg_admin_date  (admin_id, damage_date),
    INDEX idx_dmg_product     (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. Add damaged_quantity column to theft_records ─────────────────────
SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'theft_records'
      AND COLUMN_NAME  = 'damaged_quantity'
);

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE theft_records ADD COLUMN damaged_quantity INT NOT NULL DEFAULT 0 AFTER missing_quantity',
    'SELECT "damaged_quantity already exists" AS info');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ── 3. Add unexplained_loss column to theft_records ─────────────────────
SET @col2_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'theft_records'
      AND COLUMN_NAME  = 'unexplained_loss'
);

SET @sql2 = IF(@col2_exists = 0,
    'ALTER TABLE theft_records ADD COLUMN unexplained_loss INT NOT NULL DEFAULT 0 AFTER damaged_quantity',
    'SELECT "unexplained_loss already exists" AS info');
PREPARE stmt2 FROM @sql2; EXECUTE stmt2; DEALLOCATE PREPARE stmt2;

-- ── 4. Update the status enum to include NORMAL ──────────────────────────
-- Hibernate stores enums as VARCHAR(255) by default — no ALTER needed for new values.
-- But if your column was created as ENUM type, run this:
SET @is_enum = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'theft_records'
      AND COLUMN_NAME  = 'status'
      AND DATA_TYPE    = 'enum'
);

SET @sql3 = IF(@is_enum > 0,
    "ALTER TABLE theft_records MODIFY COLUMN status ENUM('NORMAL','DETECTED','INVESTIGATED','RESOLVED') NOT NULL DEFAULT 'DETECTED'",
    'SELECT "status is VARCHAR, no change needed" AS info');
PREPARE stmt3 FROM @sql3; EXECUTE stmt3; DEALLOCATE PREPARE stmt3;

-- ── 5. Backfill existing theft_records with defaults ─────────────────────
UPDATE theft_records
SET damaged_quantity = 0,
    unexplained_loss = missing_quantity
WHERE damaged_quantity IS NULL
   OR unexplained_loss IS NULL;

-- ── 6. Verify ─────────────────────────────────────────────────────────────
SELECT 'damage_records' AS tbl, COUNT(*) AS rows FROM damage_records
UNION ALL
SELECT 'theft_records',          COUNT(*)            FROM theft_records;

DESCRIBE damage_records;
DESCRIBE theft_records;

-- ═══════════════════════════════════════════════════════════════════════
-- Done. Restart the Spring Boot backend after running this script.
-- ═══════════════════════════════════════════════════════════════════════
