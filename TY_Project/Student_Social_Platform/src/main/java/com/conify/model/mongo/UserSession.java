package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "user_sessions")
public class UserSession {
    @Id
    private String id;

    private Long userId;
    private String username;
    private String ipAddress;
    
    private Instant loginTime;
    private Instant logoutTime;
    
    // CRITICAL FIX: The type must be String in the model
    private String status; 

    public UserSession() {}

    public UserSession(Long userId, String username, String ipAddress, Instant loginTime) {
        this.userId = userId;
        this.username = username;
        this.ipAddress = ipAddress;
        this.loginTime = loginTime;
        this.status = "ACTIVE"; 
    }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getIpAddress() { return ipAddress; }
    public void setIpAddress(String ipAddress) { this.ipAddress = ipAddress; }
    public Instant getLoginTime() { return loginTime; }
    public void setLoginTime(Instant loginTime) { this.loginTime = loginTime; }
    public Instant getLogoutTime() { return logoutTime; }
    public void setLogoutTime(Instant logoutTime) { this.logoutTime = logoutTime; }
    
    // CRITICAL FIX: The setter must accept a String
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}