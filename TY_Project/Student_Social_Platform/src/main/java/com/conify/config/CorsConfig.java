package com.conify.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        System.out.println("🟢 Applying Global CORS Configuration...");

        registry.addMapping("/**")
                // CHANGED: Use allowedOriginPatterns("*") instead of specific URLs.
                // This allows your dynamic Cloudflare Tunnel URLs to work automatically.
                .allowedOriginPatterns("*")
                
                // Allow standard HTTP methods
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                
                // Allow all headers
                .allowedHeaders("*")
                
                // Allow cookies/auth tokens
                .allowCredentials(true)
                
                .maxAge(3600);
        
        System.out.println("🟢 CORS Configured: Accepting all origins (Cloudflare Compatible)");
    }
}