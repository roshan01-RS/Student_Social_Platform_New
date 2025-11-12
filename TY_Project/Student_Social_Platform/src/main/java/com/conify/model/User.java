package com.conify.model;

import jakarta.persistence.*;
import java.sql.Timestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false,unique = true)
    private String username;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;
    
    // --- NEW FIELD ADDED ---
    @Column(name = "school_name")
    private String schoolName;

    private String otp;

    @Column(name = "otp_created_at")
    private Timestamp otpCreatedAt;

    @Column(name = "is_verified", nullable = false)
    private Integer isVerified = 0;

    @Column(name = "registration_successful_at")
    private Timestamp registrationSuccessfulAt;

     // --- NEW FIELDS FOR FORGOT PASSWORD ---
    @Column(name = "reset_token")
    private String resetToken;

    @Column(name = "reset_token_expiry")
    private Timestamp resetTokenExpiry;

    // --- Getters and Setters ---
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    
    // --- NEW Getter/Setter for schoolName ---
    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }
    
    public String getOtp() { return otp; }
    public void setOtp(String otp) { this.otp = otp; }
    public Timestamp getOtpCreatedAt() { return otpCreatedAt; }
    public void setOtpCreatedAt(Timestamp otpCreatedAt) { this.otpCreatedAt = otpCreatedAt; }
    public Integer getIsVerified() { return isVerified; }
    public void setIsVerified(Integer isVerified) { this.isVerified = isVerified; }
    public Timestamp getRegistrationSuccessfulAt() { return registrationSuccessfulAt; }
    public void setRegistrationSuccessfulAt(Timestamp registrationSuccessfulAt) {
        this.registrationSuccessfulAt = registrationSuccessfulAt;
    }
    public String getResetToken() { return resetToken; }
    public void setResetToken(String resetToken) { this.resetToken = resetToken; }
    public Timestamp getResetTokenExpiry() { return resetTokenExpiry; }
    public void setResetTokenExpiry(Timestamp resetTokenExpiry) { this.resetTokenExpiry = resetTokenExpiry; }
}