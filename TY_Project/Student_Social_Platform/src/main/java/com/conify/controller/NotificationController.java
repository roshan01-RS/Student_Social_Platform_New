package com.conify.controller;

import com.conify.model.mongo.Notification;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.NotificationRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    @GetMapping
    public ResponseEntity<?> getMyNotifications(@CookieValue(name="authToken") String token) {
        if (!jwtUtil.validateToken(token)) return ResponseEntity.status(401).build();
        String username = jwtUtil.getUsernameFromToken(token);
        Long userId = userRepository.findByUsername(username).get().getId();

        List<Notification> list = notificationRepository.findByRecipientIdOrderByCreatedAtDesc(userId);
        return ResponseEntity.ok(list);
    }
}