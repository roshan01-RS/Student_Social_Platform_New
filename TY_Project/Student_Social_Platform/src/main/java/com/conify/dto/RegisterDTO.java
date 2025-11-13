package com.conify.dto;

public class RegisterDTO {
    private String username;
    private String email;
    private String password;
    private String school;
    private String birthday; // ADDED

    // --- Getters and Setters ---
    
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    
    public String getSchool() { return school; }
    public void setSchool(String school) { this.school = school; }

    // ADDED
    public String getBirthday() { return birthday; }
    public void setBirthday(String birthday) { this.birthday = birthday; }
}