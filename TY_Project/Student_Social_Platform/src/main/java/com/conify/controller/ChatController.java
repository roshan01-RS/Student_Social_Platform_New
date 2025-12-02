package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.ChatMessage;
import com.conify.model.mongo.Conversation;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.ChatMessageRepository;
import com.conify.repository.mongo.ConversationRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.security.Principal;
import java.time.Instant;
import java.util.*;

@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private UserRepository userRepository; // To look up User ID from Username

    @Autowired
    private UserProfileRepository userProfileRepository; // To get Avatar/Name for UI

    // --- WebSocket: Send Message ---
    // Endpoint: /app/chat
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage, Principal principal) {
        try {
            // 1. Identify Sender
            // In a real app, 'principal.getName()' returns the username from the handshake.
            // For simplicity with simple STOMP clients, we might send senderId in payload,
            // but secure apps use Principal. Let's assume the payload has senderId for now 
            // if you aren't using a custom handshake handler yet.
            // Better: Validate senderId matches the token user.
            
            // NOTE: Ensure your frontend sends 'senderId' and 'recipientId'.
            
            chatMessage.setTimestamp(Instant.now());
            chatMessage.setStatus(ChatMessage.MessageStatus.DELIVERED);

            // 2. Generate/Find Conversation ID
            // Logic: ID is "minId_maxId" to ensure uniqueness regardless of who started it
            long minId = Math.min(chatMessage.getSenderId(), chatMessage.getRecipientId());
            long maxId = Math.max(chatMessage.getSenderId(), chatMessage.getRecipientId());
            String conversationId = minId + "_" + maxId;
            chatMessage.setConversationId(conversationId);

            // 3. Save Message to MongoDB
            ChatMessage savedMsg = chatMessageRepository.save(chatMessage);

            // 4. Update Conversation Document (Sidebar Data)
            updateConversation(conversationId, chatMessage);

            // 5. Push to Recipient (Real-time)
            // Destination: /user/{recipientId}/queue/messages
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(chatMessage.getRecipientId()),
                    "/queue/messages",
                    savedMsg
            );
            
            // 6. Push to Sender (so they see the Ack/Timestamp)
             messagingTemplate.convertAndSendToUser(
                    String.valueOf(chatMessage.getSenderId()),
                    "/queue/messages",
                    savedMsg
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- REST: Get Chat History ---
    @GetMapping("/api/messages/{recipientId}")
    @ResponseBody
    public List<ChatMessage> getChatHistory(@RequestParam("senderId") Long senderId, 
                                            @PathVariable Long recipientId) {
        long minId = Math.min(senderId, recipientId);
        long maxId = Math.max(senderId, recipientId);
        String conversationId = minId + "_" + maxId;
        
        return chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId);
    }

    // --- REST: Get Conversations List (Sidebar) ---
    @GetMapping("/api/conversations")
    @ResponseBody
    public List<Map<String, Object>> getConversations(@RequestParam("userId") Long userId) {
        List<Conversation> conversations = conversationRepository.findByParticipantsContaining(userId);
        
        // Transform to DTO for Frontend (Name, Avatar, LastMessage)
        List<Map<String, Object>> result = new ArrayList<>();
        
        for (Conversation conv : conversations) {
            // Find the "Other" participant
            Long otherUserId = conv.getParticipants().stream()
                    .filter(id -> !id.equals(userId))
                    .findFirst()
                    .orElse(null);

            if (otherUserId != null) {
                // Fetch Profile for Name/Avatar
                Optional<UserProfile> otherProfile = userProfileRepository.findByUserId(otherUserId);
                
                Map<String, Object> dto = new HashMap<>();
                dto.put("conversationId", conv.getId());
                dto.put("otherUserId", otherUserId);
                dto.put("name", otherProfile.map(UserProfile::getUsername).orElse("User " + otherUserId));
                dto.put("avatar", otherProfile.map(UserProfile::getAvatarUrl).orElse("default_avatar.png"));
                dto.put("lastMessage", conv.getLastMessage().content);
                dto.put("timestamp", conv.getLastMessage().timestamp);
                
                // Get unread count
                Integer unread = conv.getUnreadCounts() != null ? conv.getUnreadCounts().get(String.valueOf(userId)) : 0;
                dto.put("unread", unread == null ? 0 : unread);
                
                result.add(dto);
            }
        }
        
        // Sort by newest first
        result.sort((a, b) -> ((Instant) b.get("timestamp")).compareTo((Instant) a.get("timestamp")));
        
        return result;
    }

    // --- Helper: Update Conversation ---
    private void updateConversation(String conversationId, ChatMessage msg) {
        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        Conversation conv;
        
        if (convOpt.isPresent()) {
            conv = convOpt.get();
        } else {
            // Create new conversation
            conv = new Conversation();
            conv.setId(conversationId);
            conv.setParticipants(Arrays.asList(msg.getSenderId(), msg.getRecipientId()));
            conv.setUnreadCounts(new HashMap<>());
        }

        // Update Last Message
        Conversation.LastMessage lastMsg = new Conversation.LastMessage(
                msg.getSenderId(),
                msg.getContent(),
                msg.getTimestamp()
        );
        conv.setLastMessage(lastMsg);

        // Increment Unread Count for Recipient
        Map<String, Integer> counts = conv.getUnreadCounts();
        String recipientKey = String.valueOf(msg.getRecipientId());
        counts.put(recipientKey, counts.getOrDefault(recipientKey, 0) + 1);
        conv.setUnreadCounts(counts);

        conversationRepository.save(conv);
    }
}