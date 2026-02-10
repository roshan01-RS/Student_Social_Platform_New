package com.conify.controller;

import com.conify.model.mongo.ChatMessage;
import com.conify.model.mongo.Conversation;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.ChatMessageRepository;
import com.conify.repository.mongo.ConversationRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.PostService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.time.Instant;
import java.util.*;

@RestController
class ChatRestEndpoints {
    @Autowired private ChatController chatController;
    @Autowired private PostService postService;

    @GetMapping("/api/conversations")
    public List<Map<String, Object>> getConversations(@RequestParam("userId") Long userId) {
        return chatController.getConversations(userId);
    }

    @GetMapping("/api/messages/{recipientId}")
    public Map<String, Object> getChatHistory(@RequestParam("senderId") Long senderId, @PathVariable Long recipientId) {
        return chatController.getChatHistory(senderId, recipientId);
    }

    @PostMapping("/api/posts/upload-photo")
    public ResponseEntity<?> uploadPhoto(@RequestPart("file") MultipartFile file) {
        try {
            String mediaUrl = postService.saveAndCompressImage(file);
            return ResponseEntity.ok(Map.of("url", mediaUrl));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Image upload failed."));
        }
    }
}

@Controller
public class ChatController {

    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private ConversationRepository conversationRepository;
    @Autowired private UserProfileRepository userProfileRepository;

    // =========================
    // 🔥 WebSocket: Send Message (WITH REPLY SUPPORT)
    // =========================
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage, Principal principal) {
        try {
            chatMessage.setTimestamp(Instant.now());
            chatMessage.setStatus(ChatMessage.MessageStatus.DELIVERED);

            long minId = Math.min(chatMessage.getSenderId(), chatMessage.getRecipientId());
            long maxId = Math.max(chatMessage.getSenderId(), chatMessage.getRecipientId());
            String conversationId = minId + "_" + maxId;
            chatMessage.setConversationId(conversationId);

            // 🔥 REPLY SAFETY: normalize empty values
            if (chatMessage.getReplyToMessageId() == null ||
                chatMessage.getReplyToMessageId().isBlank()) {
                chatMessage.setReplyToMessageId(null);
                chatMessage.setReplyToContent(null);
                chatMessage.setReplyToSenderId(null);
            }

            ChatMessage savedMsg = chatMessageRepository.save(chatMessage);

            updateConversation(
                    conversationId,
                    savedMsg.getSenderId(),
                    savedMsg.getRecipientId(),
                    savedMsg.getContent(),
                    savedMsg.getTimestamp(),
                    savedMsg.getId()
            );

            messagingTemplate.convertAndSendToUser(
                    String.valueOf(savedMsg.getRecipientId()),
                    "/queue/messages",
                    savedMsg
            );

            messagingTemplate.convertAndSendToUser(
                    String.valueOf(savedMsg.getSenderId()),
                    "/queue/messages",
                    savedMsg
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- REST: Get Conversations List ---
    public List<Map<String, Object>> getConversations(Long userId) {
        List<Conversation> conversations = conversationRepository.findByParticipantsContaining(userId);
        List<Map<String, Object>> result = new ArrayList<>();

        for (Conversation conv : conversations) {
            Long otherUserId = conv.getParticipants().stream()
                    .filter(id -> !id.equals(userId))
                    .findFirst()
                    .orElse(null);

            if (otherUserId != null) {
                Optional<UserProfile> otherProfile = userProfileRepository.findByUserId(otherUserId);

                Map<String, Object> dto = new HashMap<>();
                dto.put("conversationId", conv.getId());
                dto.put("otherUserId", otherUserId);
                dto.put("name", otherProfile.map(UserProfile::getUsername).orElse("User " + otherUserId));
                dto.put("avatar", otherProfile.map(UserProfile::getAvatarUrl).orElse("default_avatar.png"));

                if (conv.getLastMessage() != null) {
                    dto.put("lastMessage", conv.getLastMessage().content);
                    dto.put("timestamp", conv.getLastMessage().timestamp);
                } else {
                    dto.put("lastMessage", "Start chatting");
                    dto.put("timestamp", Instant.EPOCH);
                }

                Integer unread = 0;
                if (conv.getUnreadCounts() != null &&
                    conv.getUnreadCounts().get(String.valueOf(userId)) != null) {
                    unread = conv.getUnreadCounts().get(String.valueOf(userId));
                }
                dto.put("unread", unread);

                result.add(dto);
            }
        }

        result.sort((a, b) ->
                ((Instant) b.get("timestamp")).compareTo((Instant) a.get("timestamp")));

        return result;
    }

    private void updateConversation(String conversationId, Long senderId, Long recipientId,
                                    String content, Instant timestamp, String messageId) {

        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        Conversation conv = convOpt.orElseGet(() -> {
            Conversation c = new Conversation();
            c.setId(conversationId);
            c.setParticipants(Arrays.asList(senderId, recipientId));
            c.setUnreadCounts(new HashMap<>());
            c.setLastReadMessageIds(new HashMap<>());
            return c;
        });

        conv.setLastMessage(new Conversation.LastMessage(senderId, content, timestamp));

        Map<String, Integer> counts = conv.getUnreadCounts();
        String recipientKey = String.valueOf(recipientId);
        counts.put(recipientKey, counts.getOrDefault(recipientKey, 0) + 1);

        conversationRepository.save(conv);
    }

    // --- REST: Get Chat History ---
    public Map<String, Object> getChatHistory(Long senderId, Long recipientId) {
        long minId = Math.min(senderId, recipientId);
        long maxId = Math.max(senderId, recipientId);
        String conversationId = minId + "_" + maxId;

        List<ChatMessage> messages =
                chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId);

        String firstUnreadId = messages.stream()
                .filter(m -> m.getSenderId().equals(recipientId)
                        && m.getRecipientId().equals(senderId)
                        && m.getStatus() != ChatMessage.MessageStatus.READ)
                .map(ChatMessage::getId)
                .findFirst()
                .orElse(null);

        Map<String, Object> response = new HashMap<>();
        response.put("messages", messages);
        response.put("firstUnreadId", firstUnreadId);

        return response;
    }
}
