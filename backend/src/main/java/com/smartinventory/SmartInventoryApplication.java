package com.smartinventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.io.File;
import java.nio.file.Files;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class SmartInventoryApplication {

    public static void main(String[] args) {
        loadDotenv();
        SpringApplication.run(SmartInventoryApplication.class, args);
    }

    /**
     * Loads environment variables from a .env file into System properties
     * before the Spring context initializes.
     *
     * Resolution order (first found wins):
     *   1. ../.env   (project root when running from backend/ directory)
     *   2. .env      (project root when running from project root)
     *
     * Any key already present as a real OS environment variable or system
     * property takes precedence — this file only fills gaps.
     */
    private static void loadDotenv() {
        File envFile = new File("../.env");
        if (!envFile.exists()) {
            envFile = new File(".env");
        }
        if (!envFile.exists()) {
            System.out.println("[DotEnv] No .env file found — relying on OS environment variables.");
            return;
        }

        try {
            Files.lines(envFile.toPath())
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .forEach(line -> {
                        int idx = line.indexOf('=');
                        if (idx <= 0) return;
                        String key   = line.substring(0, idx).trim();
                        String value = line.substring(idx + 1).trim();
                        // Strip surrounding quotes if present
                        if (value.length() >= 2
                                && ((value.startsWith("\"") && value.endsWith("\""))
                                 || (value.startsWith("'")  && value.endsWith("'")))) {
                            value = value.substring(1, value.length() - 1);
                        }
                        // OS env vars take precedence; only set if not already defined
                        if (System.getenv(key) == null && System.getProperty(key) == null) {
                            System.setProperty(key, value);
                        }
                    });
            System.out.println("[DotEnv] Loaded environment from: " + envFile.getAbsolutePath());
        } catch (Exception e) {
            System.err.println("[DotEnv] Failed to load .env file: " + e.getMessage());
        }
    }
}
