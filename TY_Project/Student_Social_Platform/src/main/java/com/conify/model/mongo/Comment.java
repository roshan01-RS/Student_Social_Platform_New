package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "comments")
public class Comment {
    @Id
    private String id;
    
    private String postId;
    private Long userId;
    
    private String content;
    private Instant timestamp = Instant.now();
    
    // For nested replies (optional depth)
    private String parentCommentId; 
    
    // Snapshot of author details to avoid extra lookups
    private AuthorSnapshot author;

    public static class AuthorSnapshot {
        public String username;
        public String avatarUrl;
        
        public AuthorSnapshot() {}
        public AuthorSnapshot(String username, String avatarUrl) {
            this.username = username;
            this.avatarUrl = avatarUrl;
        }
    }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getPostId() { return postId; }
    public void setPostId(String postId) { this.postId = postId; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    public String getParentCommentId() { return parentCommentId; }
    public void setParentCommentId(String parentCommentId) { this.parentCommentId = parentCommentId; }
    public AuthorSnapshot getAuthor() { return author; }
    public void setAuthor(AuthorSnapshot author) { this.author = author; }
}