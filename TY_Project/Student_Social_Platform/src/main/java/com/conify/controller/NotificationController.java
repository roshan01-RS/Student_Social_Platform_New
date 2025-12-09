package com.conify.controller;

import com.conify.model.mongo.Notification;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.NotificationRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    private Long getUserIdFromToken(String token) throws RuntimeException {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        return userRepository.findByUsername(username).get().getId();
    }


    @GetMapping
    public ResponseEntity<?> getMyNotifications(@CookieValue(name="authToken") String token) {
        try {
            Long userId = getUserIdFromToken(token);
            List<Notification> list = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
            return ResponseEntity.ok(list);
        } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
        }
    }
    
    // NEW ENDPOINT: Mark all notifications as read
    @PostMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead(@CookieValue(name="authToken") String token) {
         try {
            Long userId = getUserIdFromToken(token);
            
            List<Notification> unreadNotifications = notificationRepository.findByRecipientIdAndIsReadFalse(userId);
            
            for (Notification n : unreadNotifications) {
                n.setRead(true);
                notificationRepository.save(n);
            }
            
            return ResponseEntity.ok(Map.of("message", "Notifications marked as read"));
         } catch (Exception e) {
            return ResponseEntity.status(401).body(Map.of("error", e.getMessage()));
         }
    }
}