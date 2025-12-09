package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.UserProfile;
import com.conify.model.mongo.Friendship.FriendshipStatus;
import com.conify.service.FriendshipService;
import com.conify.service.JwtUtil;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.HashMap;

@RestController
@RequestMapping("/api/friendship")
public class FriendshipController {

    @Autowired private FriendshipService friendshipService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository; 

    private Long getCurrentUserId(String token) throws RuntimeException {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
    
    // --- 1. Search Users ---
    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam String query) {

        if (token == null || query.length() < 3) return ResponseEntity.ok(List.of());

        try {
            Long currentUserId = getCurrentUserId(token);
            List<UserProfile> results = friendshipService.searchUsers(query);
            
            List<Map<String, Object>> responseList = results.stream()
                .filter(p -> !p.getUserId().equals(currentUserId))
                .map(p -> {
                    FriendshipStatus status = friendshipService.getFriendshipStatus(currentUserId, p.getUserId());
                    
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUserId());
                    map.put("username", p.getUsername().replace("@", "")); 
                    map.put("avatarUrl", p.getAvatarUrl());
                    map.put("major", p.getMajor());
                    map.put("schoolName", p.getSchoolName());
                    map.put("status", status != null ? status.toString() : "NONE");
                    return map;
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(responseList);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
    
    // --- 2. Get Accepted Friends + Pending Requests List (FIXED METHOD CALL) ---
    @GetMapping("/list-friends")
    public ResponseEntity<?> getFriendsList(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Long currentUserId = getCurrentUserId(token);
            // CRITICAL FIX: Calling the correctly named service method
            List<UserProfile> users = friendshipService.getFriendsAndRequests(currentUserId);
            
            List<Map<String, Object>> responseList = users.stream()
                .map(p -> {
                    FriendshipStatus status = friendshipService.getFriendshipStatus(currentUserId, p.getUserId());
                    Map<String, Object> map = new HashMap<>();
                    map.put("userId", p.getUserId());
                    map.put("username", p.getUsername().replace("@", ""));
                    map.put("avatarUrl", p.getAvatarUrl());
                    map.put("major", p.getMajor());
                    map.put("schoolName", p.getSchoolName());
                    // Status will be ACCEPTED or PENDING (for sent requests)
                    map.put("status", status != null ? status.toString() : "NONE");
                    return map;
                })
                .collect(Collectors.toList());

            return ResponseEntity.ok(responseList);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to retrieve friends list."));
        }
    }

    // --- 3. Send Friend Request ---
    @PostMapping("/request")
    public ResponseEntity<?> sendRequest(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Long> request) {

        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Long requesterId = getCurrentUserId(token);
            Long recipientId = request.get("recipientId");

            friendshipService.sendFriendRequest(requesterId, recipientId);
            
            return ResponseEntity.ok(Map.of("message", "Friend request sent successfully."));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }

    // --- 4. Respond to Request (Accept/Reject) ---
    @PostMapping("/respond")
    public ResponseEntity<?> respondToRequest(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Object> response) {

        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Long currentUserId = getCurrentUserId(token);
            Long requesterId = ((Number) response.get("requesterId")).longValue();
            String action = (String) response.get("action");

            friendshipService.respondToRequest(currentUserId, requesterId, action);
            
            return ResponseEntity.ok(Map.of("message", "Request " + action + "ed successfully."));
            
        } catch (IllegalArgumentException e) {
             return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to respond."));
        }
    }

    // --- 5. NEW: Remove/Unfriend Endpoint (Handles ACCEPTED and PENDING statuses) ---
    @PostMapping("/remove")
    public ResponseEntity<?> removeFriend(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Long> request) {

        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Long currentUserId = getCurrentUserId(token);
            Long targetUserId = request.get("targetUserId");

            friendshipService.removeFriendship(currentUserId, targetUserId);
            return ResponseEntity.ok(Map.of("message", "Friendship status updated."));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Failed to remove friend."));
        }
    }
}