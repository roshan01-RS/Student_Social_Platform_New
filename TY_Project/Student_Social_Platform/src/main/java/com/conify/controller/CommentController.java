package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.Comment;
import com.conify.service.CommentService;
import com.conify.service.JwtUtil;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/comments")
public class CommentController {

    @Autowired private CommentService commentService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    // Get Comments for a Post
    @GetMapping("/post/{postId}")
    public ResponseEntity<?> getComments(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String postId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(commentService.getCommentsForPost(postId));
    }

    // Get Replies for a Comment
    @GetMapping("/{commentId}/replies")
    public ResponseEntity<?> getReplies(
            @CookieValue(name = "authToken", required = false) String token,
            @PathVariable String commentId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        return ResponseEntity.ok(commentService.getReplies(commentId));
    }

    // Add Comment/Reply
    @PostMapping("/add")
    public ResponseEntity<?> addComment(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, String> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            Long userId = getCurrentUserId(token);
            String postId = payload.get("postId");
            String content = payload.get("content");
            String parentId = payload.get("parentCommentId"); // Optional

            Comment comment = commentService.addComment(userId, postId, content, parentId);
            return ResponseEntity.ok(comment);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", e.getMessage()));
        }
    }
}