package com.smartinventory.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class DatabaseInitializer implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) throws Exception {
        try {
            log.info("Altering otp_verifications.otp_type column to VARCHAR(50)...");
            jdbcTemplate.execute("ALTER TABLE otp_verifications MODIFY COLUMN otp_type VARCHAR(50) NOT NULL");
            log.info("Successfully altered otp_verifications.otp_type to VARCHAR(50)");
        } catch (Exception e) {
            log.warn("Could not alter otp_verifications table: {}", e.getMessage());
        }

        try {
            log.info("Altering invoices.status column to VARCHAR(50)...");
            jdbcTemplate.execute("ALTER TABLE invoices MODIFY COLUMN status VARCHAR(50) NOT NULL");
            log.info("Successfully altered invoices.status to VARCHAR(50)");
        } catch (Exception e) {
            log.warn("Could not alter invoices table: {}", e.getMessage());
        }

        // Ensure all necessary columns exist in product_returns
        String[] alterStatements = {
            "ALTER TABLE product_returns ADD COLUMN supplier_id BIGINT DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN status VARCHAR(255) DEFAULT 'PENDING'",
            "ALTER TABLE product_returns ADD COLUMN rejection_reason VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN evidence_urls VARCHAR(2000) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN customer_decision VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN refund_amount DECIMAL(10, 2) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN refund_method VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN refund_date DATETIME DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN exchanged_product_id BIGINT DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN exchanged_product_quantity INT DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN exchange_new_invoice_id BIGINT DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN exchange_new_invoice_number VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN processed_by VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN `condition` VARCHAR(255) DEFAULT NULL",
            "ALTER TABLE supply_requests ADD COLUMN unit VARCHAR(50) DEFAULT NULL",
            "ALTER TABLE supply_requests ADD COLUMN unit_size VARCHAR(50) DEFAULT NULL",
            "ALTER TABLE supplier_products ADD COLUMN unit_size VARCHAR(50) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN ai_confidence_score DECIMAL(5, 2) DEFAULT NULL",
            "ALTER TABLE product_returns ADD COLUMN ai_validation_status VARCHAR(50) DEFAULT NULL"
        };

        for (String sql : alterStatements) {
            try {
                jdbcTemplate.execute(sql);
                log.info("Successfully executed manual schema migration: {}", sql);
            } catch (Exception e) {
                log.debug("Manual DDL statement skipped (likely already exists): {}. Error: {}", sql, e.getMessage());
            }
        }

        // One-time migration to populate barcodes for existing products where barcode is NULL
        try {
            log.info("Running one-time barcode migration for existing products...");
            int rows1 = jdbcTemplate.update(
                "UPDATE products p " +
                "JOIN supply_requests sr ON sr.product_id = p.id " +
                "JOIN supplier_products sp ON sr.supplier_product_id = sp.id " +
                "SET p.barcode = sp.barcode_number " +
                "WHERE p.barcode IS NULL AND sp.barcode_number IS NOT NULL AND sp.barcode_number <> ''"
            );
            log.info("Migration Step 1 (Supply Requests): Updated {} products with barcodes.", rows1);

            int rows2 = jdbcTemplate.update(
                "UPDATE products p " +
                "JOIN supplier_products sp ON LOWER(sp.name) = LOWER(p.name) " +
                "SET p.barcode = sp.barcode_number " +
                "WHERE p.barcode IS NULL AND sp.barcode_number IS NOT NULL AND sp.barcode_number <> ''"
            );
            log.info("Migration Step 2 (Supplier Product Names): Updated {} products with barcodes.", rows2);

            int rows3 = jdbcTemplate.update(
                "UPDATE products p " +
                "JOIN product_batches pb ON pb.product_id = p.id " +
                "SET p.barcode = pb.barcode " +
                "WHERE p.barcode IS NULL AND pb.barcode IS NOT NULL AND pb.barcode <> ''"
            );
            log.info("Migration Step 3 (Product Batches): Updated {} products with barcodes.", rows3);

            List<Map<String, Object>> allProducts = jdbcTemplate.queryForList("SELECT id, name, barcode FROM products");
            log.info("=== DIAGNOSTIC: ALL PRODUCTS IN DATABASE ===");
            for (Map<String, Object> p : allProducts) {
                log.info("  Product ID: {}, Name: {}, Barcode: {}", p.get("id"), p.get("name"), p.get("barcode"));
            }
            log.info("=============================================");
        } catch (Exception e) {
            log.warn("Barcode migration encountered an issue: {}", e.getMessage());
        }
    }
}
