package com.conify.controller;

import com.conify.model.mongo.Post;
import com.conify.service.JwtUtil;
import com.conify.service.PostService;
import com.conify.repository.UserRepository;
import com.conify.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostService postService;

    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserRepository userRepository; // Need to look up ID from username in token

    // --- 1. Create Post ---
    @PostMapping("/create")
    public ResponseEntity<?> createPost(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }

        try {
            // Get User ID
            String username = jwtUtil.getUsernameFromToken(token);
            // Since JWT has username, we fetch the ID from SQLite quickly (Auth Layer)
            // Ideally JWT should have ID, but this works with your current setup.
            Optional<User> userOpt = userRepository.findByUsername(username);
            if(userOpt.isEmpty()) return ResponseEntity.status(401).build();
            
            Long userId = userOpt.get().getId();

            Post createdPost = postService.createPost(userId, content, file);
            return ResponseEntity.ok(createdPost);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }

    // --- 2. Get Feed ---
    @GetMapping("/feed")
    public ResponseEntity<?> getFeed(@CookieValue(name = "authToken", required = false) String token) {
        // Feed is public to logged in users
        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token"));
        }
        
        List<Post> posts = postService.getFeed();
        return ResponseEntity.ok(posts);
    }

    // --- 3. Toggle Like ---
    @PostMapping("/{postId}/like")
    public ResponseEntity<?> toggleLike(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String postId) {

        if (token == null || !jwtUtil.validateToken(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        try {
            String username = jwtUtil.getUsernameFromToken(token);
            User user = userRepository.findByUsername(username).orElseThrow();
            
            Post updatedPost = postService.toggleLike(postId, user.getId());
            return ResponseEntity.ok(updatedPost);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("error", e.getMessage()));
        }
    }
}