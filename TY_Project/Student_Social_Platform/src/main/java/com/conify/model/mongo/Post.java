package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "posts")
public class Post {
    @Id
    private String id;
    
    private Long userId;
    
    private AuthorSnapshot authorSnapshot;

    private String content;
    private String mediaUrl;
    private MediaType mediaType; 
    
    private Instant createdAt = Instant.now();
    
    private List<Long> likes = new ArrayList<>();
    
    // --- UPDATED: Ensure both likeCount and commentCount exist ---
    private int likeCount = 0; 
    private int commentCount = 0;
    
    private String communityId; 

    public enum MediaType { IMAGE, VIDEO, NONE }

    public static class AuthorSnapshot {
        public String username;
        public String avatarUrl;
        public String major;
        
        public AuthorSnapshot() {}
        public AuthorSnapshot(String username, String avatarUrl, String major) {
            this.username = username;
            this.avatarUrl = avatarUrl;
            this.major = major;
        }
    }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public AuthorSnapshot getAuthorSnapshot() { return authorSnapshot; }
    public void setAuthorSnapshot(AuthorSnapshot authorSnapshot) { this.authorSnapshot = authorSnapshot; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }
    public MediaType getMediaType() { return mediaType; }
    public void setMediaType(MediaType mediaType) { this.mediaType = mediaType; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public List<Long> getLikes() { return likes; }
    public void setLikes(List<Long> likes) { this.likes = likes; }
    
    // --- UPDATED: Added missing Setter for likeCount ---
    public int getLikeCount() { return likeCount; }
    public void setLikeCount(int likeCount) { this.likeCount = likeCount; }
    
    public int getCommentCount() { return commentCount; }
    public void setCommentCount(int commentCount) { this.commentCount = commentCount; }
    public String getCommunityId() { return communityId; }
    public void setCommunityId(String communityId) { this.communityId = communityId; }
}