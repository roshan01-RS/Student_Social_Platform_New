package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.Post;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil;
import com.conify.service.PostService;
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

    private Long getUserId(String token) {
        if (token == null || !jwtUtil.validateToken(token)) {
            throw new RuntimeException("Invalid token");
        }
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    /* =====================================================
       CREATE POST
       ===================================================== */
    @PostMapping("/create")
    public ResponseEntity<?> createPost(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam(value = "content", required = false) String content,
            @RequestParam(value = "file", required = false) MultipartFile file) {

        try {
            Long userId = getUserId(token);
            Post post = postService.createPost(userId, content, file);
            return ResponseEntity.ok(post);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* =====================================================
       UPLOAD MEDIA (USED BY CHAT / COMMUNITY)
       ===================================================== */
    @PostMapping("/create-media")
    public ResponseEntity<?> uploadMedia(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam("file") MultipartFile file) {

        try {
            getUserId(token); // validates token
            String url = postService.saveAndCompressImage(file);
            return ResponseEntity.ok(Map.of("url", url));
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* =====================================================
       FEED
       ===================================================== */
    @GetMapping("/feed")
    public ResponseEntity<?> getFeed(
            @CookieValue(name = "authToken", required = false) String token) {

        try {
            getUserId(token);
            List<Post> feed = postService.getFeed();
            return ResponseEntity.ok(feed);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /* =====================================================
       LIKE / UNLIKE (RACE SAFE)
       ===================================================== */
    @PostMapping("/{id}/like")
    public ResponseEntity<?> toggleLike(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String id) {

        try {
            Long userId = getUserId(token);
            Post post = postService.toggleLike(id, userId);
            return ResponseEntity.ok(post);
        } catch (Exception e) {
            return ResponseEntity
                    .status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", e.getMessage()));
        }
    }
}
