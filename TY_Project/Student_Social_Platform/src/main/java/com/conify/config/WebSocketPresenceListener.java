// =======================
// FILE 3 (VERIFY / KEEP AS-IS)
// src/main/java/com/conify/config/WebSocketPresenceListener.java
// =======================
package com.conify.config;

import com.conify.service.PresenceService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
public class WebSocketPresenceListener {

    @Autowired
    private PresenceService presenceService;

    @EventListener
    public void onConnect(SessionConnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() == null) return;

        try {
            Long userId = Long.valueOf(accessor.getUser().getName());
            presenceService.userConnected(userId, accessor.getSessionId());
        } catch (Exception ignored) {}
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        if (accessor.getUser() == null) return;

        try {
            Long userId = Long.valueOf(accessor.getUser().getName());
            presenceService.userDisconnected(userId, accessor.getSessionId());
        } catch (Exception ignored) {}
    }
}
