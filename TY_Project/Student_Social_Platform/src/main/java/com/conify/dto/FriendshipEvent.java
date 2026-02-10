package com.conify.dto;

public class FriendshipEvent {

    private Long sourceUserId;
    private Long targetUserId;
    private String status;     // PENDING / ACCEPTED / NONE
    private String direction;  // INCOMING / OUTGOING / FRIEND / NONE

    public FriendshipEvent(Long sourceUserId, Long targetUserId, String status, String direction) {
        this.sourceUserId = sourceUserId;
        this.targetUserId = targetUserId;
        this.status = status;
        this.direction = direction;
    }

    public Long getSourceUserId() { return sourceUserId; }
    public Long getTargetUserId() { return targetUserId; }
    public String getStatus() { return status; }
    public String getDirection() { return direction; }
}
