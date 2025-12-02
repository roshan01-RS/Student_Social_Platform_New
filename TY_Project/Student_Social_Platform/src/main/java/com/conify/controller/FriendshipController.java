package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.UserProfile;
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

@RestController
@RequestMapping("/api/friendship")
public class FriendshipController {

    @Autowired private FriendshipService friendshipService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository; // For getting User ID from token username

    // Helper to get current user ID from token
    private Long getCurrentUserId(String token) throws RuntimeException {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        // Look up ID from SQLite using username
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }
    
    // --- 1. Search Users ---
    // Endpoint: /api/friendship/search?query=roshan
    @GetMapping("/search")
    public ResponseEntity<?> searchUsers(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam String query) {

        if (token == null || query.length() < 3) return ResponseEntity.ok(List.of());

        try {
            // Service searches MongoDB UserProfiles by username prefix
            List<UserProfile> results = friendshipService.searchUsers(query);
            
            // Filter out the current user from results (optional, but good UX)
            Long currentUserId = getCurrentUserId(token);
            List<UserProfile> filtered = results.stream()
                .filter(p -> !p.getUserId().equals(currentUserId))
                .collect(Collectors.toList());

            return ResponseEntity.ok(filtered);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // --- 2. Send Friend Request ---
    // Endpoint: POST /api/friendship/request
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

    // --- 3. Respond to Request (Accept/Reject) ---
    // Endpoint: POST /api/friendship/respond
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
}