package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.Community;
import com.conify.model.mongo.CommunityMessage;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.CommunityMessageRepository;
import com.conify.repository.mongo.CommunityRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.CommunityService;
import com.conify.service.JwtUtil;
import com.conify.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    @Autowired private CommunityService communityService;
    @Autowired private CommunityRepository communityRepository; 
    @Autowired private CommunityMessageRepository messageRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private NotificationService notificationService; // Added integration

    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @GetMapping("/my-communities")
    public ResponseEntity<?> getMyCommunities(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            return ResponseEntity.ok(communityService.getUserCommunities(userId));
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @GetMapping("/list")
    public ResponseEntity<?> searchCommunities(@CookieValue(name = "authToken", required = false) String token, @RequestParam(required = false) String query) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(communityService.searchCommunities(query));
    }

    @PostMapping("/create")
    public ResponseEntity<?> createCommunity(@CookieValue(name = "authToken", required = false) String token, @RequestBody Map<String, String> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            return ResponseEntity.ok(communityService.createCommunity(payload.get("name"), payload.get("description"), payload.getOrDefault("icon", "🌐"), userId));
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> toggleJoin(@CookieValue(name = "authToken", required = false) String token, @PathVariable String id) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Community updated = communityService.toggleMembership(id, userId);
            boolean isMember = updated.getMemberIds().contains(userId);

            // NOTIFICATION: Trigger when joining
            if (isMember) {
                notificationService.createNotification(
                    userId, 
                    updated.getOwnerId(), 
                    Notification.NotificationType.FRIEND_ACCEPT, // Reusing type or mapping to join
                    "joined your community: " + updated.getName(), 
                    id, 
                    null
                );
            }

            return ResponseEntity.ok(Map.of("joined", isMember, "members", updated.getMemberIds().size()));
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }
    
    @GetMapping("/{id}/messages")
    public ResponseEntity<?> getMessages(@CookieValue(name = "authToken", required = false) String token, @PathVariable String id) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(messageRepository.findByCommunityIdOrderByTimestampDesc(id));
    }

    @PostMapping("/{id}/messages")
    public ResponseEntity<?> postMessage(@CookieValue(name = "authToken", required = false) String token, @PathVariable String id, @RequestBody Map<String, String> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Optional<Community> commOpt = communityRepository.findById(id);
            if (commOpt.isEmpty()) return ResponseEntity.notFound().build();
            Community comm = commOpt.get();
            if (!comm.getOwnerId().equals(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

            UserProfile profile = userProfileRepository.findByUserId(userId).orElseThrow();
            CommunityMessage msg = new CommunityMessage();
            msg.setCommunityId(id);
            msg.setSenderId(userId);
            msg.setSenderName(profile.getUsername());
            msg.setSenderAvatar(profile.getAvatarUrl());
            msg.setContent(payload.get("content"));
            msg.setMediaUrl(payload.get("mediaUrl"));
            msg.setTimestamp(Instant.now());
            messageRepository.save(msg);
            
            // NOTIFY MEMBERS
            for (Long memberId : comm.getMemberIds()) {
                if (!memberId.equals(userId)) {
                    notificationService.createNotification(userId, memberId, Notification.NotificationType.COMMUNITY_POST, "posted in " + comm.getName(), id, msg.getId());
                }
            }
            return ResponseEntity.ok(msg);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }
    
    @PostMapping("/messages/{messageId}/like")
    public ResponseEntity<?> toggleMessageLike(@CookieValue(name = "authToken", required = false) String token, @PathVariable String messageId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Optional<CommunityMessage> msgOpt = messageRepository.findById(messageId);
            if (msgOpt.isEmpty()) return ResponseEntity.notFound().build();
            CommunityMessage msg = msgOpt.get();
            if (msg.getLikes().contains(userId)) {
                msg.getLikes().remove(userId);
            } else {
                msg.getLikes().add(userId);
                // NOTIFY AUTHOR
                notificationService.createNotification(userId, msg.getSenderId(), Notification.NotificationType.POST_LIKE, "liked your community post", msg.getCommunityId(), msg.getId());
            }
            messageRepository.save(msg);
            return ResponseEntity.ok(msg);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }
}