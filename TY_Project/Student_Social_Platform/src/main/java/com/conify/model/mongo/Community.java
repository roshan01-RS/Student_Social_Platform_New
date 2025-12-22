package com.conify.model.mongo;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

@Document(collection = "communities")
public class Community {
    @Id
    private String id;
    
    private String name;
    private String description;
    private String icon; 
    private Long ownerId;
    
    // Set of User IDs who are members
    private Set<Long> memberIds = new HashSet<>();
    
    // Map<UserId (String), JoinDate (Instant)> to track when they joined
    private Map<String, Instant> memberJoinDates = new HashMap<>();
    
    private Instant createdAt = Instant.now();

    // Getters and Setters
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public Long getOwnerId() { return ownerId; }
    public void setOwnerId(Long ownerId) { this.ownerId = ownerId; }
    public Set<Long> getMemberIds() { return memberIds; }
    public void setMemberIds(Set<Long> memberIds) { this.memberIds = memberIds; }
    public Map<String, Instant> getMemberJoinDates() { return memberJoinDates; }
    public void setMemberJoinDates(Map<String, Instant> memberJoinDates) { this.memberJoinDates = memberJoinDates; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}