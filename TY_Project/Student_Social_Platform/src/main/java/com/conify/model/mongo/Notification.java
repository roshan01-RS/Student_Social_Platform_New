package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;
    
    private Long recipientId; // Who gets it
    private Long senderId;    // Who triggered it
    
    private SenderSnapshot senderSnapshot;
    
    private NotificationType type;
    private String message; 
    
    private String relatedEntityId; // ID of post/comment/group
    private boolean isRead = false;
    private Instant createdAt = Instant.now();

    public enum NotificationType {
        LIKE, COMMENT, FRIEND_REQ, FRIEND_ACCEPT, FRIEND_REJECT, GROUP_ADD, FOLLOW
    }

    public static class SenderSnapshot {
        public String username;
        public String avatarUrl;
        public SenderSnapshot() {}
        public SenderSnapshot(String username, String avatarUrl) {
            this.username = username;
            this.avatarUrl = avatarUrl;
        }
    }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }
    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }
    public SenderSnapshot getSenderSnapshot() { return senderSnapshot; }
    public void setSenderSnapshot(SenderSnapshot senderSnapshot) { this.senderSnapshot = senderSnapshot; }
    public NotificationType getType() { return type; }
    public void setType(NotificationType type) { this.type = type; }
    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }
    public String getRelatedEntityId() { return relatedEntityId; }
    public void setRelatedEntityId(String relatedEntityId) { this.relatedEntityId = relatedEntityId; }
    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}