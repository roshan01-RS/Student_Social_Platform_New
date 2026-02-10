package com.conify.controller;

import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.UserRepository;
import com.conify.service.AdminService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AdminService adminService;

    /* -------------------------------------------------
       PENDING VERIFICATIONS
    ------------------------------------------------- */

    @GetMapping("/pending-verifications")
    public ResponseEntity<List<Map<String, Object>>> getPendingVerifications() {

        List<UserProfile> pendingUsers =
                userProfileRepository.findByVerificationStatus("PENDING");

        List<Map<String, Object>> response = pendingUsers.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId()); // Mongo ID
            map.put("name", u.getUsername() != null ? u.getUsername().replace("@", "") : "Unknown");
            map.put("studentId", "UID-" + u.getUserId());
            map.put("submittedDate", u.getVerificationSubmittedAt());
            map.put("course", u.getMajor() != null ? u.getMajor() : "N/A");
            map.put("rollNumber", "N/A");

            Map<String, String> docs = new HashMap<>();
            docs.put("idCard", u.getIdCardUrl());
            docs.put("feesReceipt", u.getReceiptUrl());

            map.put("documents", docs);
            return map;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    /* -------------------------------------------------
       VERIFY / REJECT STUDENT (🔥 REALTIME ENABLED)
    ------------------------------------------------- */

    @PostMapping("/verify")
    public ResponseEntity<?> verifyStudent(@RequestBody Map<String, String> payload) {

        try {
            String profileId = payload.get("userId");
            String status = payload.get("status");

            if (profileId == null || status == null) {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Missing userId or status"));
            }

            // 🔥 IMPORTANT: Delegate to service (WebSocket happens there)
            adminService.processVerification(profileId, status);

            return ResponseEntity.ok(
                    Map.of("message", "Verification status updated to " + status)
            );

        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* -------------------------------------------------
       USERS
    ------------------------------------------------- */

    @GetMapping("/users")
    public ResponseEntity<List<UserProfile>> getAllUsers() {
        return ResponseEntity.ok(userProfileRepository.findAll());
    }

    @GetMapping("/users/{id}")
    public ResponseEntity<UserProfile> getUserDetails(@PathVariable String id) {
        return userProfileRepository.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    /* -------------------------------------------------
       DELETE USER (MONGO + SQLITE)
    ------------------------------------------------- */

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {

        return userProfileRepository.findById(id).map(profile -> {

            Long sqlUserId = profile.getUserId();

            // 1️⃣ Delete Mongo profile
            userProfileRepository.delete(profile);

            // 2️⃣ Delete SQLite auth user
            if (sqlUserId != null && userRepository.existsById(sqlUserId)) {
                userRepository.deleteById(sqlUserId);
            }

            return ResponseEntity.ok(
                    Map.of("message", "User deleted successfully")
            );

        }).orElse(ResponseEntity.notFound().build());
    }

    /* -------------------------------------------------
       ADMIN AUTH
    ------------------------------------------------- */

    @PostMapping("/verify-token")
    public ResponseEntity<?> verifyToken(
            @CookieValue(name = "adminAuthToken", required = false) String token) {

        if (token != null && !token.isEmpty()) {
            return ResponseEntity.ok().build();
        }
        return ResponseEntity.status(401).build();
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(
            jakarta.servlet.http.HttpServletResponse response) {

        jakarta.servlet.http.Cookie cookie =
                new jakarta.servlet.http.Cookie("adminAuthToken", null);

        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0);
        response.addCookie(cookie);

        return ResponseEntity.ok().build();
    }
}
