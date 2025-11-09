package com.conify.dto;

public class ResendDTO {
    private String email;
    // Optional: we can use this to send standard messages back if needed
    private String message;

    public ResendDTO() {}

    public ResendDTO(String email, String message) {
        this.email = email;
        this.message = message;
    }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
}