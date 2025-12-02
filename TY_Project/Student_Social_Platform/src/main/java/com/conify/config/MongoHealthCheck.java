package com.conify.config;

import com.mongodb.ConnectionString;
import com.mongodb.MongoClientSettings;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.MongoDatabase;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.concurrent.TimeUnit;

@Component
public class MongoHealthCheck implements CommandLineRunner {

    @Value("${spring.data.mongodb.uri}")
    private String mongoUri;

    @Override
    public void run(String... args) throws Exception {
        System.out.println("--- Starting MongoDB Connection Test ---");
        
        try {
            // Build MongoClientSettings with a connection timeout
            ConnectionString connectionString = new ConnectionString(mongoUri);
            
            MongoClientSettings settings = MongoClientSettings.builder()
                    .applyConnectionString(connectionString)
                    .applyToClusterSettings(builder -> 
                        builder.serverSelectionTimeout(5000, TimeUnit.MILLISECONDS)) // 5 second timeout
                    .build();

            // Attempt to create the client and get a database reference
            try (MongoClient mongoClient = MongoClients.create(settings)) {
                
                // Pinging the primary server by trying to access a database
                MongoDatabase database = mongoClient.getDatabase(connectionString.getDatabase());
                database.runCommand(new org.bson.Document("ping", 1));

                System.out.println("✅ MongoDB Atlas Connection SUCCESSFUL to database: " + connectionString.getDatabase());
                System.out.println("----------------------------------------------");
            }

        } catch (Exception e) {
            System.err.println("❌ CRITICAL MONGODB CONNECTION FAILURE ❌");
            System.err.println("Cause: " + e.getMessage());
            System.err.println("Troubleshoot:");
            System.err.println("1. IP Whitelist: Ensure your current public IP is whitelisted in MongoDB Atlas.");
            System.err.println("2. Connection String: Verify the username, password, and cluster name are correct in application.properties.");
            System.err.println("----------------------------------------------");
            // NOTE: We don't re-throw the exception here, as Spring might handle it later, 
            // but we provide clear console output for immediate troubleshooting.
        }
    }
}