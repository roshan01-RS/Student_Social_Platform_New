package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.time.LocalDate;

@Document(collection = "user_profiles")
public class UserProfile {
    @Id
    private String id;

    @Indexed(unique = true)
    private Long userId; // Link to SQLite User ID

    // --- Read-Only Identity Fields (Synced from SQLite) ---
    private String username; // Stored with '@' prefix
    private String email;
    private String schoolName;
    private LocalDate birthday;
    private Instant joinedAt;
    
    // NEW FIELD: Account validation expiration date
    private Instant accountExpireDate;

    // --- Editable Profile Fields ---
    private String avatarUrl;
    private String bio;
    private String major;
    
    private Instant lastActive;

    public UserProfile() {}
    public UserProfile(Long userId) { this.userId = userId; }

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }
    public LocalDate getBirthday() { return birthday; }
    public void setBirthday(LocalDate birthday) { this.birthday = birthday; }
    public Instant getJoinedAt() { return joinedAt; }
    public void setJoinedAt(Instant joinedAt) { this.joinedAt = joinedAt; }
    
    // NEW ACCESSORS
    public Instant getAccountExpireDate() { return accountExpireDate; }
    public void setAccountExpireDate(Instant accountExpireDate) { this.accountExpireDate = accountExpireDate; }
    
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public String getBio() { return bio; }
    public void setBio(String bio) { this.bio = bio; }
    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }
    public Instant getLastActive() { return lastActive; }
    public void setLastActive(Instant lastActive) { this.lastActive = lastActive; }
}