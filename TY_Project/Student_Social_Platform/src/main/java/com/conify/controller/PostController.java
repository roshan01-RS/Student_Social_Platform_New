package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.Post;
import com.conify.service.JwtUtil;
import com.conify.service.PostService;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostService postService;

    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserRepository userRepository; 

    private Long getCurrentUserId(String token) throws RuntimeException {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @PostMapping("/create")
    public ResponseEntity<?> createPost(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }

        try {
            Long userId = getCurrentUserId(token);
            Post createdPost = postService.createPost(userId, content, file);
            return ResponseEntity.ok(createdPost);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/create-media")
    public ResponseEntity<Map<String, String>> uploadChatMedia(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam("file") MultipartFile file) {

        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized."));
        }

        try {
            // Note: postService.saveAndCompressImage must be public in PostService.java
            String mediaUrl = postService.saveAndCompressImage(file);
            return ResponseEntity.ok(Map.of("url", mediaUrl));

        } catch (Exception e) {
            System.err.println("Media upload failed: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Media upload failed."));
        }
    }

    @GetMapping("/feed")
    public ResponseEntity<?> getFeed(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }
        
        List<Post> posts = postService.getFeed();
        return ResponseEntity.ok(posts);
    }

    @PostMapping("/{postId}/like")
    public ResponseEntity<?> toggleLike(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String postId) {

        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            Long userId = getCurrentUserId(token);
            Post updatedPost = postService.toggleLike(postId, userId);
            return ResponseEntity.ok(updatedPost);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}