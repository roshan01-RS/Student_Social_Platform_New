package com.conify.controller;

import com.conify.model.User;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil; // FIXED: Correct package
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.CookieValue; // <-- FIXED: Changed import
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ProfileController {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @GetMapping("/my-profile")
    // FIXED: Changed from @RequestHeader to @CookieValue
    public ResponseEntity<Map<String, String>> getMyProfile(
            @CookieValue(name = "authToken", required = false) String token) {
        
        // 1. Check if the cookie (token) is present
        if (token == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Missing authentication token"));
        }

        try {
            // 2. Validate the token
            if (!jwtUtil.validateToken(token)) {
                 return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid or expired token"));
            }

            // 3. Get username from the token
            String username = jwtUtil.getUsernameFromToken(token);

            // 4. Get the user's data from the database
            Optional<User> userOpt = userRepository.findByUsername(username); 

            if (userOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User not found"));
            }

            User user = userOpt.get();

            // 5. Send back ONLY the safe data
            Map<String, String> profileData = new HashMap<>();
            profileData.put("username", user.getUsername());
            profileData.put("email", user.getEmail());
            profileData.put("schoolName", user.getSchoolName());

            return ResponseEntity.ok(profileData);

        } catch (Exception e) {
            // Catches any other JWT errors
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", e.getMessage()));
        }
    }
}