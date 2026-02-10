package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.Community;
import com.conify.model.mongo.CommunityMessage;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.CommunityMessageRepository;
import com.conify.repository.mongo.CommunityRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.CommunityService;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.*;


@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    @Autowired private CommunityRepository communityRepository;
    @Autowired private CommunityMessageRepository messageRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private CommunityService communityService;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    // ================= AUTH =================
    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) {
            throw new RuntimeException("Invalid token");
        }
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // ================= MY COMMUNITIES =================
    @GetMapping("/my-communities")
    public ResponseEntity<?> getMyCommunities(
            @CookieValue(name = "authToken", required = false) String token) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long userId = getCurrentUserId(token);
        return ResponseEntity.ok(communityService.getUserCommunities(userId));
    }

    // ================= LIST / SEARCH COMMUNITIES =================
    @GetMapping("/list")
    public ResponseEntity<?> listCommunities(
            @RequestParam(value = "query", required = false) String query) {

        List<Community> communities;

        if (query == null || query.trim().isEmpty()) {
            communities = communityRepository.findAll();
        } else {
            communities = communityRepository
                    .findByNameContainingIgnoreCase(query.trim());
        }

        return ResponseEntity.ok(communities);
    }

    // ================= CREATE COMMUNITY =================
    @PostMapping("/create")
    public ResponseEntity<?> createCommunity(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, String> payload) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long userId = getCurrentUserId(token);
        String name = payload.get("name");

        if (name == null || name.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Community name required");
        }

        Community community = new Community();
        community.setName(name.trim());
        community.setDescription(payload.getOrDefault("description", ""));
        community.setIcon(payload.getOrDefault("icon", "🌐"));
        community.setOwnerId(userId);
        community.setMemberIds(new HashSet<>(Set.of(userId)));
        community.setCreatedAt(Instant.now());

        communityRepository.save(community);

        return ResponseEntity.ok(community);
    }

    // ================= JOIN / LEAVE COMMUNITY =================
    @PostMapping("/{id}/join")
    public ResponseEntity<?> toggleJoin(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String id) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long userId = getCurrentUserId(token);
        Community community = communityRepository.findById(id).orElseThrow();

        boolean joined;
        if (community.getMemberIds().contains(userId)) {
            community.getMemberIds().remove(userId);
            joined = false;
        } else {
            community.getMemberIds().add(userId);
            joined = true;
        }

        communityRepository.save(community);

        return ResponseEntity.ok(Map.of("joined", joined));
    }

    // ================= GET COMMUNITY MESSAGES =================
    @GetMapping("/{id}/messages")
    public ResponseEntity<?> getCommunityMessages(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String id) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        communityRepository.findById(id).orElseThrow();

        return ResponseEntity.ok(
                messageRepository.findByCommunityIdOrderByTimestampDesc(id)
        );
    }

    // ================= POST MESSAGE =================
    @PostMapping("/{id}/messages")
    public ResponseEntity<?> postMessage(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String id,
            @RequestBody Map<String, String> payload) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long userId = getCurrentUserId(token);
        Community community = communityRepository.findById(id).orElseThrow();

        if (!community.getOwnerId().equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }

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

        messagingTemplate.convertAndSend(
                "/topic/community/" + id,
                Map.of("type", "POST_CREATED", "post", msg)
        );

        return ResponseEntity.ok(msg);
    }

    // ================= LIKE / UNLIKE =================
    @PostMapping("/messages/{messageId}/like")
    public ResponseEntity<?> toggleLike(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String messageId) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long userId = getCurrentUserId(token);
        CommunityMessage msg = messageRepository.findById(messageId).orElseThrow();

        boolean liked;
        if (msg.getLikes().contains(userId)) {
            msg.getLikes().remove(userId);
            liked = false;
        } else {
            msg.getLikes().add(userId);
            liked = true;
        }

        messageRepository.save(msg);

        messagingTemplate.convertAndSend(
                "/topic/community/" + msg.getCommunityId(),
                Map.of(
                        "type", "POST_LIKED",
                        "postId", msg.getId(),
                        "likeCount", msg.getLikes().size(),
                        "liked", liked
                )
        );

        return ResponseEntity.ok(msg);
    }
}
