package com.conify.controller;

import com.conify.model.mongo.StudentGroup;
import com.conify.repository.mongo.StudentGroupRepository;
import com.conify.service.JwtUtil;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.time.Instant;
import java.util.List;
import java.util.Arrays;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    @Autowired private StudentGroupRepository groupRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;

    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@CookieValue(name="authToken") String token, @RequestBody StudentGroup group) {
        String username = jwtUtil.getUsernameFromToken(token);
        Long userId = userRepository.findByUsername(username).get().getId();

        group.setAdminId(userId);
        group.setMemberIds(Arrays.asList(userId)); // Add creator as first member
        group.setCreatedAt(Instant.now());
        if(group.getIcon() == null) group.setIcon("🛡️");

        return ResponseEntity.ok(groupRepository.save(group));
    }

    @GetMapping("/my-groups")
    public ResponseEntity<?> getMyGroups(@CookieValue(name="authToken") String token) {
        String username = jwtUtil.getUsernameFromToken(token);
        Long userId = userRepository.findByUsername(username).get().getId();
        return ResponseEntity.ok(groupRepository.findByMemberIdsContaining(userId));
    }
}