package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.GroupMessage;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.StudentGroup;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.GroupMessageRepository;
import com.conify.repository.mongo.StudentGroupRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.JwtUtil;
import com.conify.service.NotificationService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/groups")
public class GroupController {

    @Autowired private StudentGroupRepository groupRepository;
    @Autowired private GroupMessageRepository messageRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private NotificationService notificationService; // Added integration

    private Long getCurrentUserId(String token) {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }

    @GetMapping
    public ResponseEntity<?> getUserGroups(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            List<StudentGroup> groups = groupRepository.findUserGroups(userId);
            groups.sort((g1, g2) -> g2.getLastUpdated().compareTo(g1.getLastUpdated()));
            return ResponseEntity.ok(groups);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@CookieValue(name = "authToken", required = false) String token, @RequestBody Map<String, String> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            StudentGroup group = new StudentGroup();
            group.setName(payload.get("name"));
            group.setIcon(payload.getOrDefault("icon", "👥"));
            group.setOwnerId(userId);
            group.getMemberIds().add(userId);
            group.getMemberJoinDates().put(String.valueOf(userId), Instant.now());
            group.setLastMessage("Group created");
            group.setLastUpdated(Instant.now());
            StudentGroup saved = groupRepository.save(group);
            createSystemMessage(saved.getId(), "Group created by " + getUsername(userId));
            return ResponseEntity.ok(saved);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @GetMapping("/{groupId}/messages")
    public ResponseEntity<?> getMessages(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if(groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            Instant joinDate = group.getMemberJoinDates().get(String.valueOf(userId));
            List<GroupMessage> allMessages = messageRepository.findByGroupIdOrderByTimestampAsc(groupId);
            if (joinDate != null) {
                return ResponseEntity.ok(allMessages.stream().filter(m -> !m.getTimestamp().isBefore(joinDate)).collect(Collectors.toList()));
            } else { return ResponseEntity.ok(List.of()); }
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{groupId}/messages")
    public ResponseEntity<?> sendMessage(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId, @RequestBody Map<String, String> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            UserProfile profile = userProfileRepository.findByUserId(userId).orElseThrow();
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            if (!group.getMemberIds().contains(userId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();

            GroupMessage msg = new GroupMessage();
            msg.setGroupId(groupId);
            msg.setSenderId(userId);
            msg.setSenderName(profile.getUsername());
            msg.setSenderAvatar(profile.getAvatarUrl());
            msg.setContent(payload.get("content"));
            msg.setMediaUrl(payload.get("mediaUrl"));
            msg.setTimestamp(Instant.now());
            msg.setType(msg.getMediaUrl() != null ? GroupMessage.MessageType.IMAGE : GroupMessage.MessageType.TEXT);
            messageRepository.save(msg);

            group.setLastMessage(msg.getType() == GroupMessage.MessageType.IMAGE ? "📷 Photo" : msg.getContent());
            group.setLastUpdated(Instant.now());
            groupRepository.save(group);

            // NOTIFY MEMBERS
            for (Long memberId : group.getMemberIds()) {
                if (!memberId.equals(userId)) {
                    notificationService.createNotification(userId, memberId, Notification.NotificationType.GROUP_MESSAGE, "sent a message in " + group.getName(), groupId, msg.getId());
                }
            }
            return ResponseEntity.ok(msg);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{groupId}/members")
    public ResponseEntity<?> addMembers(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId, @RequestBody Map<String, List<Long>> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long currentUserId = getCurrentUserId(token); 
            List<Long> newMemberIds = payload.get("memberIds");
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            if (!group.getOwnerId().equals(currentUserId)) return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            
            List<String> addedNames = new java.util.ArrayList<>();
            for (Long id : newMemberIds) {
                if (!group.getMemberIds().contains(id)) {
                    group.getMemberIds().add(id);
                    group.getMemberJoinDates().put(String.valueOf(id), Instant.now());
                    addedNames.add(getUsername(id));
                    // NOTIFY ADDED USER
                    notificationService.createNotification(currentUserId, id, Notification.NotificationType.GROUP_ADD, "added you to " + group.getName(), groupId, null);
                }
            }
            if (!addedNames.isEmpty()) {
                createSystemMessage(groupId, getUsername(currentUserId) + " added " + String.join(", ", addedNames));
                groupRepository.save(group);
            }
            return ResponseEntity.ok(group);
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{groupId}/leave")
    public ResponseEntity<?> leaveGroup(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            if (group.getMemberIds().contains(userId)) {
                group.getMemberIds().remove(userId);
                createSystemMessage(groupId, getUsername(userId) + " left");
                groupRepository.save(group);
                return ResponseEntity.ok(Map.of("message", "Left group"));
            }
            return ResponseEntity.badRequest().build();
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{groupId}/join")
    public ResponseEntity<?> joinGroup(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long userId = getCurrentUserId(token);
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            if (group.getMemberIds().contains(userId)) return ResponseEntity.badRequest().build();
            group.getJoinRequests().add(userId);
            groupRepository.save(group);
            // NOTIFY ADMIN
            notificationService.createNotification(userId, group.getOwnerId(), Notification.NotificationType.GROUP_ADD, "requested to join " + group.getName(), groupId, null);
            return ResponseEntity.ok(Map.of("message", "Request sent"));
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    @PostMapping("/{groupId}/approve")
    public ResponseEntity<?> approveJoin(@CookieValue(name = "authToken", required = false) String token, @PathVariable String groupId, @RequestBody Map<String, Object> payload) {
        if (token == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        try {
            Long approverId = getCurrentUserId(token);
            Long targetUserId = ((Number) payload.get("targetUserId")).longValue();
            boolean accept = (boolean) payload.get("accept");
            Optional<StudentGroup> groupOpt = groupRepository.findById(groupId);
            if (groupOpt.isEmpty()) return ResponseEntity.notFound().build();
            StudentGroup group = groupOpt.get();
            if (group.getJoinRequests().contains(targetUserId)) {
                group.getJoinRequests().remove(targetUserId);
                if (accept) {
                    group.getMemberIds().add(targetUserId);
                    group.getMemberJoinDates().put(String.valueOf(targetUserId), Instant.now());
                    createSystemMessage(groupId, getUsername(approverId) + " added " + getUsername(targetUserId));
                    // NOTIFY USER
                    notificationService.createNotification(approverId, targetUserId, Notification.NotificationType.GROUP_ADD, "approved your join request for " + group.getName(), groupId, null);
                }
                groupRepository.save(group);
            }
            return ResponseEntity.ok(Map.of("message", "Processed"));
        } catch (Exception e) { return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build(); }
    }

    private void createSystemMessage(String groupId, String text) {
        GroupMessage sys = new GroupMessage();
        sys.setGroupId(groupId);
        sys.setType(GroupMessage.MessageType.SYSTEM);
        sys.setContent(text);
        sys.setTimestamp(Instant.now());
        messageRepository.save(sys);
    }
    private String getUsername(Long userId) {
        return userProfileRepository.findByUserId(userId).map(UserProfile::getUsername).orElse("Unknown User");
    }
}