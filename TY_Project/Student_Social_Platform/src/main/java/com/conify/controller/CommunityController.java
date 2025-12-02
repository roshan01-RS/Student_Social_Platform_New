package com.conify.controller;

import com.conify.model.mongo.Community;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.CommunityRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/api/communities")
public class CommunityController {

    @Autowired private CommunityRepository communityRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    @PostMapping("/create")
    public ResponseEntity<?> create(@CookieValue(name="authToken") String token, @RequestBody Community comm) {
        if (!jwtUtil.validateToken(token)) return ResponseEntity.status(401).build();
        String username = jwtUtil.getUsernameFromToken(token);
        Long userId = userRepository.findByUsername(username).get().getId();

        comm.setAdminId(userId);
        comm.setCreatedAt(Instant.now());
        comm.getMemberIds().add(userId);
        comm.setMemberCount(1);
        
        return ResponseEntity.ok(communityRepository.save(comm));
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam(required = false) String query) {
        if (query == null || query.isEmpty()) {
            return ResponseEntity.ok(communityRepository.findAll()); // Ideally limit this
        }
        return ResponseEntity.ok(communityRepository.findByNameContainingIgnoreCase(query));
    }

    @PostMapping("/{id}/join")
    public ResponseEntity<?> join(@CookieValue(name="authToken") String token, @PathVariable String id) {
        String username = jwtUtil.getUsernameFromToken(token);
        Long userId = userRepository.findByUsername(username).get().getId();

        Community c = communityRepository.findById(id).orElseThrow();
        if (!c.getMemberIds().contains(userId)) {
            c.getMemberIds().add(userId);
            c.setMemberCount(c.getMemberCount() + 1);
            communityRepository.save(c);
        }
        return ResponseEntity.ok(c);
    }
}