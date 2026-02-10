package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;

@Document(collection = "group_messages")
public class GroupMessage {
    @Id
    private String id;

    private String groupId;
    private Long senderId;
    private String senderName;
    private String senderAvatar;

    private String content;
    private String mediaUrl;
    private MessageType type; // TEXT, IMAGE, SYSTEM

    private Instant timestamp = Instant.now();

    // 🔥 REPLY FIELDS (NEW)
    private String replyToMessageId;
    private String replyToSenderName;
    private String replyToContent;

    public enum MessageType { TEXT, IMAGE, SYSTEM }

    public GroupMessage() {}

    // ---------------- GETTERS / SETTERS ----------------

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getGroupId() { return groupId; }
    public void setGroupId(String groupId) { this.groupId = groupId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public String getSenderAvatar() { return senderAvatar; }
    public void setSenderAvatar(String senderAvatar) { this.senderAvatar = senderAvatar; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getMediaUrl() { return mediaUrl; }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = mediaUrl; }

    public MessageType getType() { return type; }
    public void setType(MessageType type) { this.type = type; }

    public Instant getTimestamp() { return timestamp; }
    public void setTimestamp(Instant timestamp) { this.timestamp = timestamp; }

    // 🔥 REPLY ACCESSORS
    public String getReplyToMessageId() { return replyToMessageId; }
    public void setReplyToMessageId(String replyToMessageId) { this.replyToMessageId = replyToMessageId; }

    public String getReplyToSenderName() { return replyToSenderName; }
    public void setReplyToSenderName(String replyToSenderName) { this.replyToSenderName = replyToSenderName; }

    public String getReplyToContent() { return replyToContent; }
    public void setReplyToContent(String replyToContent) { this.replyToContent = replyToContent; }
}
