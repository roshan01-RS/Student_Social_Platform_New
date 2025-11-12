package com.conify.dto;

public class LoginDTO {
    // FIXED: Changed 'email' to 'identifier' to match the frontend
    private String identifier;
    private String password;

    // Getters and Setters
    public String getIdentifier() { return identifier; }
    public void setIdentifier(String identifier) { this.identifier = identifier; }
    
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}