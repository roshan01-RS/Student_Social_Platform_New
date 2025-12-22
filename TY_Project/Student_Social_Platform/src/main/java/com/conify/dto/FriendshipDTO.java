package com.conify.dto;

public class FriendshipDTO {

    private Long userId;
    private String username;
    private String avatarUrl;
    private String major;
    private String schoolName;

    // PENDING / ACCEPTED
    private String status;

    // INCOMING / OUTGOING / FRIEND
    private String direction;

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public String getMajor() { return major; }
    public void setMajor(String major) { this.major = major; }

    public String getSchoolName() { return schoolName; }
    public void setSchoolName(String schoolName) { this.schoolName = schoolName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getDirection() { return direction; }
    public void setDirection(String direction) { this.direction = direction; }
}
