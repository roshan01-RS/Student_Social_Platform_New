package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "notifications")
public class Notification {
    @Id
    private String id;

    private Long recipientId; // Who receives the notification
    private Long senderId;    // Who triggered it
    
    // Snapshot to avoid extra DB lookups on frontend
    private SenderSnapshot senderSnapshot;

    private NotificationType type;
    private String message; // Human readable text (e.g., "liked your post")
    
    // Links to the source content
    private String referenceId; // e.g., PostID, GroupID, CommunityID
    private String subReferenceId; // e.g., CommentID (optional)

    private boolean isRead = false;
    private Instant timestamp = Instant.now();

    public enum NotificationType {
        FRIEND_REQ, FRIEND_ACCEPT, FRIEND_REJECT,
        GROUP_ADD, GROUP_MESSAGE,
        COMMUNITY_POST, COMMUNITY_JOIN,
        POST_LIKE, POST_COMMENT, COMMENT_REPLY,
        SYSTEM // Required by AdminService
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

    // Getters and Setters
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
    public String getReferenceId() { return referenceId; }
    public void setReferenceId(String referenceId) { this.referenceId = referenceId; }
    public String getSubReferenceId() { return subReferenceId; }
    public void setSubReferenceId(String subReferenceId) { this.subReferenceId = subReferenceId; }
    public boolean isRead() { return isRead; }
    public void setRead(boolean read) { isRead = read; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
}