package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "chat_messages")
public class ChatMessage {
    @Id
    private String id;
    
    private String conversationId; // Link to Conversation
    private Long senderId;
    private Long recipientId; // Null if group/community
    
    private String content;
    private String mediaUrl;
    private MessageType type; 
    private MessageStatus status; 
    
    private Instant timestamp = Instant.now();

    // NEW: Used to pass back info on which message was read, or who is typing
    private String messageId;
    private Long readerId;
    private Long originalSenderId;

    // ADDED TYPING and READ_ACK for WebSocket events that won't be persisted as message documents
    public enum MessageType { TEXT, IMAGE, EMOJI, SYSTEM, TYPING, READ_ACK }
    public enum MessageStatus { SENT, DELIVERED, READ }

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getConversationId() { return conversationId; }
    public void setConversationId(String conversationId) { this.conversationId = conversationId; }
    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }
    public Long getRecipientId() { return recipientId; }
    public void setRecipientId(Long recipientId) { this.recipientId = recipientId; }
    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }
    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }
    public MessageStatus getStatus() { return status; }
    public void setStatus(MessageStatus status) { this.status = status; }
    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }
    
    // NEW Accessors for WebSocket events
    public String getMessageId() { return messageId; }
    public void setMessageId(String messageId) { this.messageId = messageId; }
    public Long getReaderId() { return readerId; }
    public void setReaderId(Long readerId) { this.readerId = readerId; }
    public Long getOriginalSenderId() { return originalSenderId; }
    public void setOriginalSenderId(Long originalSenderId) { this.originalSenderId = originalSenderId; }
}