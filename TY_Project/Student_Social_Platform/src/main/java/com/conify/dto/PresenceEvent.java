package com.conify.dto;

public class PresenceEvent {

    private Long userId;
    private boolean online;

    public PresenceEvent() {}

    public PresenceEvent(Long userId, boolean online) {
        this.userId = userId;
        this.online = online;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public boolean isOnline() {
        return online;
    }

    public void setOnline(boolean online) {
        this.online = online;
    }
}
