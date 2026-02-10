package com.conify.controller;

import com.conify.model.User;
import com.conify.service.FriendshipService;
import com.conify.service.JwtUtil;
import com.conify.repository.UserRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/friendship")
public class FriendshipController {

    @Autowired private FriendshipService friendshipService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) {
            throw new RuntimeException("Invalid Token");
        }
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // ---------------- SEARCH USERS WITH STATUS ----------------
@GetMapping("/search")
public ResponseEntity<?> searchUsers(
        @CookieValue(name = "authToken", required = false) String token,
        @RequestParam String query) {

    if (token == null || query.length() < 3) {
        return ResponseEntity.ok(List.of());
    }

    Long currentUserId = getCurrentUserId(token);
    return ResponseEntity.ok(
            friendshipService.searchUsersWithStatus(query, currentUserId)
    );
}


    // ---------------- FRIEND LIST ----------------
    @GetMapping("/list-friends")
    public ResponseEntity<?> listFriends(
            @CookieValue(name = "authToken", required = false) String token) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long currentUserId = getCurrentUserId(token);
        return ResponseEntity.ok(
                friendshipService.getFriendsAndRequests(currentUserId)
        );
    }

    // ---------------- SEND REQUEST ----------------
    @PostMapping("/request")
    public ResponseEntity<?> sendRequest(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Long> body) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long requesterId = getCurrentUserId(token);
        Long recipientId = body.get("recipientId");

        friendshipService.sendFriendRequest(requesterId, recipientId);
        return ResponseEntity.ok(Map.of("message", "Friend request sent"));
    }

    // ---------------- RESPOND ----------------
    @PostMapping("/respond")
    public ResponseEntity<?> respond(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Object> body) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long currentUserId = getCurrentUserId(token);
        Long requesterId = ((Number) body.get("requesterId")).longValue();
        String action = (String) body.get("action");

        friendshipService.respond(currentUserId, requesterId, action);
        return ResponseEntity.ok(Map.of("message", "Request processed"));
    }

    // ---------------- REMOVE / CANCEL ----------------
    @PostMapping("/remove")
    public ResponseEntity<?> remove(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, Long> body) {

        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        Long currentUserId = getCurrentUserId(token);
        Long targetUserId = body.get("targetUserId");

        friendshipService.remove(currentUserId, targetUserId);
        return ResponseEntity.ok(Map.of("message", "Relationship removed"));
    }
}
