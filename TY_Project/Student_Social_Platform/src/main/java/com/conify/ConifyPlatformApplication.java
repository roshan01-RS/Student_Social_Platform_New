package com.conify;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;


@SpringBootApplication
@EnableScheduling 
public class ConifyPlatformApplication {

    public static void main(String[] args) {
        // This single line replaces your entire MainServer.java
        // It starts Tomcat on port 8181 (from application.properties)
        // It connects to SQLite (from application.properties)
        // It automatically finds your Controllers, Models, and Repositories
        SpringApplication.run(ConifyPlatformApplication.class, args);
    }

}