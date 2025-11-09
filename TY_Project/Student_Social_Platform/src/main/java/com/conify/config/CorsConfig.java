package com.conify.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // Apply CORS settings to ALL endpoints ("/**")
        registry.addMapping("/**")
                // Allow your specific frontend origins (VS Code Live Server)
                .allowedOrigins("http://127.0.0.1:5501", "http://localhost:5501")
                // Allow standard HTTP methods
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                // Allow all headers (Content-Type, Authorization, etc.)
                .allowedHeaders("*")
                // Critical for session/cookies if you use them later
                .allowCredentials(true)
                // How long the browser should cache the preflight OPTIONS response (in seconds)
                .maxAge(3600);

        System.out.println("🟢 Spring Boot CORS Configuration Loaded");
    }
}