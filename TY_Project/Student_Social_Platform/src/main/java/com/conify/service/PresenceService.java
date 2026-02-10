package com.conify.service;

import com.conify.dto.PresenceEvent;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class PresenceService {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserProfileRepository userProfileRepository;

    // userId -> active websocket sessionIds
    private final Map<Long, Set<String>> activeSessions = new ConcurrentHashMap<>();

    /* =========================
       CONNECTION MANAGEMENT
       ========================= */

    public void userConnected(Long userId, String sessionId) {
        activeSessions
                .computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet())
                .add(sessionId);

        if (activeSessions.get(userId).size() == 1) {
            broadcastPresence(userId, true);
        }
    }

    public void userDisconnected(Long userId, String sessionId) {
        Set<String> sessions = activeSessions.get(userId);
        if (sessions == null) return;

        sessions.remove(sessionId);

        if (sessions.isEmpty()) {
            activeSessions.remove(userId);
            updateLastSeen(userId);
            broadcastPresence(userId, false);
        }
    }

    /* =========================
       LAST SEEN (PERSISTED)
       ========================= */

    private void updateLastSeen(Long userId) {
        userProfileRepository.findByUserId(userId).ifPresent(profile -> {
            profile.setLastSeenAt(Instant.now());
            userProfileRepository.save(profile);
        });
    }

    public Instant getLastSeen(Long userId) {
        return userProfileRepository
                .findByUserId(userId)
                .map(UserProfile::getLastSeenAt)
                .orElse(null);
    }

    /* =========================
       ONLINE STATUS
       ========================= */

    public boolean isOnline(Long userId) {
        return activeSessions.containsKey(userId);
    }

    public Set<Long> getOnlineUsersSnapshot() {
        return new HashSet<>(activeSessions.keySet());
    }

    /* =========================
       BROADCAST
       ========================= */

    private void broadcastPresence(Long userId, boolean online) {
        messagingTemplate.convertAndSend(
                "/topic/presence",
                new PresenceEvent(userId, online)
        );
    }
}
