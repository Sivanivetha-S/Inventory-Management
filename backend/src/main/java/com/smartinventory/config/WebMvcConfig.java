package com.smartinventory.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Configures Spring MVC to serve uploaded files as static resources.
 *
 * Images uploaded to  uploads/products/  are served at:
 *   http://localhost:8080/uploads/products/<filename>
 *
 * The React frontend can display them via:
 *   <img src={`http://localhost:8080${product.productImage}`} />
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${app.upload.dir:uploads}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Resolve to absolute path so it works regardless of working directory
        String absolutePath = Paths.get(uploadDir).toAbsolutePath().normalize().toString();

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + absolutePath + "/")
                .setCachePeriod(3600);   // browser-cache 1 hour
    }
}
