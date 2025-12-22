package com.conify.controller;

import com.conify.model.User;
import com.conify.service.JwtUtil;
import com.conify.service.NotificationService;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired private NotificationService notificationService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @GetMapping
    public ResponseEntity<?> getNotifications(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            return ResponseEntity.ok(notificationService.getUserNotifications(userId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    @PostMapping("/{id}/read")
    public ResponseEntity<?> markRead(@CookieValue(name = "authToken", required = false) String token, @PathVariable String id) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        notificationService.markAsRead(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/read-all")
    public ResponseEntity<?> markAllRead(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        Long userId = getCurrentUserId(token);
        notificationService.markAllAsRead(userId);
        return ResponseEntity.ok().build();
    }
}