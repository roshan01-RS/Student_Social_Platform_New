package com.conify.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.nio.file.Paths;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // 1. Get the absolute path to your 'uploads' folder
        Path uploadDir = Paths.get("src/main/resources/static/uploads/");
        String uploadPath = uploadDir.toFile().getAbsolutePath();

        // Ensure proper trailing slash
        if (!uploadPath.endsWith(java.io.File.separator)) {
            uploadPath += java.io.File.separator;
        }

        // 2. Map URL /uploads/** to File System Path
        // 'file:///' protocol is required for absolute paths
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:///" + uploadPath);
                
        System.out.println("📂 Static Resource Mapping: /uploads/** -> " + uploadPath);
    }
}