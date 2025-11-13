package com.conify.dto;

// This DTO is used only for the pre-check
public class CheckUserDTO {
    private String username;
    private String email;

    // Getters and Setters
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}