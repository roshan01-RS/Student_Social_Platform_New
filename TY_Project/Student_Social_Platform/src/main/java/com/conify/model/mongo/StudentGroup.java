package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Document(collection = "student_groups")
public class StudentGroup {
    @Id
    private String id;
    
    private String name;
    private String icon; 
    private Long ownerId;
    
    // Active Members
    private Set<Long> memberIds = new HashSet<>();
    
    // Users who left (so group stays in their list)
    private Set<Long> leftMemberIds = new HashSet<>();
    
    // Join Requests
    private Set<Long> joinRequests = new HashSet<>();
    
    // Map<UserId (String), JoinDate (Instant)>
    private Map<String, Instant> memberJoinDates = new HashMap<>();
    
    private String lastMessage;
    private Instant lastUpdated = Instant.now();

    // Getters/Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public Set<Long> getMemberIds() { return memberIds; }
    public void setMemberIds(Set<Long> memberIds) { this.memberIds = memberIds; }
    public Set<Long> getLeftMemberIds() { return leftMemberIds; }
    public void setLeftMemberIds(Set<Long> leftMemberIds) { this.leftMemberIds = leftMemberIds; }
    public Set<Long> getJoinRequests() { return joinRequests; }
    public void setJoinRequests(Set<Long> joinRequests) { this.joinRequests = joinRequests; }
    public Map<String, Instant> getMemberJoinDates() { return memberJoinDates; }
    public void setMemberJoinDates(Map<String, Instant> memberJoinDates) { this.memberJoinDates = memberJoinDates; }
    public String getLastMessage() { return lastMessage; }
    public void setLastMessage(String lastMessage) { this.lastMessage = lastMessage; }
    public Instant getLastUpdated() { return lastUpdated; }
    public void setLastUpdated(Instant lastUpdated) { this.lastUpdated = lastUpdated; }
}