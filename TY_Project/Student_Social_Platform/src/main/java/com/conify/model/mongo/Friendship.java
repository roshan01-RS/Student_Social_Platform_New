package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "friendships")
public class Friendship {
    @Id
    private String id;
    
    private Long requesterId;
    private Long recipientId;
    
    private FriendshipStatus status; 
    private Instant createdAt = Instant.now();

    public enum FriendshipStatus { PENDING, ACCEPTED, REJECTED, BLOCKED }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Long getRequesterId() { return requesterId; }
    public void setRequesterId(Long requesterId) { this.requesterId = requesterId; }
    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }
    public FriendshipStatus getStatus() { return status; }
    public void setStatus(FriendshipStatus status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}