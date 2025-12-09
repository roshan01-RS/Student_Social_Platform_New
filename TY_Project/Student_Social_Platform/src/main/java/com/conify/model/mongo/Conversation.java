package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Document(collection = "conversations")
public class Conversation {
    @Id
    private String id;
    
    private List<Long> participants; // [101, 102]
    
    private LastMessage lastMessage;
    
    // Map of UserId (String) -> Unread Count (Integer)
    private Map<String, Integer> unreadCounts;
    
    // NEW: Map of UserId (String) -> Last Read Message ID (String)
    // Tracks the last message ID read by the *participant* corresponding to the key.
    private Map<String, String> lastReadMessageIds; 

    public static class LastMessage {
        public Long senderId;
        public String content;
        public Instant timestamp;
        public LastMessage() {}
        public LastMessage(Long senderId, String content, Instant timestamp) {
            this.senderId = senderId;
            this.content = content;
            this.timestamp = timestamp;
        }
    }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public List<Long> getParticipants() { return participants; }
    public void setParticipants(List<Long> participants) { this.participants = participants; }
    public LastMessage getLastMessage() { return lastMessage; }
    public void setLastMessage(LastMessage lastMessage) { this.lastMessage = lastMessage; }
    public Map<String, Integer> getUnreadCounts() { return unreadCounts; }
    public void setUnreadCounts(Map<String, Integer> unreadCounts) { this.unreadCounts = unreadCounts; }

    // NEW Getter/Setter for Last Read Message IDs
    public Map<String, String> getLastReadMessageIds() { return lastReadMessageIds; }
    public void setLastReadMessageIds(Map<String, String> lastReadMessageIds) { this.lastReadMessageIds = lastReadMessageIds; }
}