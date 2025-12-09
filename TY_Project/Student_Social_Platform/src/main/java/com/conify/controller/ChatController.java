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
import com.conify.service.PostService; // Import PostService for media upload
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity; // Import for ResponseEntity

import java.security.Principal;
import java.time.Instant;
import java.util.*;

// FIX: Split controller to separate REST endpoints for consistency (PostController/ProfileController pattern)
@RestController
class ChatRestEndpoints {
    @Autowired private ChatController chatController;
    @Autowired private PostService postService; // Use PostService for image upload

    @GetMapping("/api/conversations")
    public List<Map<String, Object>> getConversations(@RequestParam("userId") Long userId) {
        return chatController.getConversations(userId);
    }

    @GetMapping("/api/messages/{recipientId}")
    public Map<String, Object> getChatHistory(@RequestParam("senderId") Long senderId, @PathVariable Long recipientId) {
        // NOTE: The recipientId here is the "other" user
        return chatController.getChatHistory(senderId, recipientId);
    }
    
    // NEW: Endpoint for chat image upload (using PostService for the heavy lifting)
    // IMPORTANT: This needs to return the relative URL
    @PostMapping("/api/posts/upload-photo")
    public ResponseEntity<?> uploadPhoto(@RequestPart("file") MultipartFile file) {
        try {
            // Note: This uses the method name from PostService.java to save the content image
            String mediaUrl = postService.saveAndCompressImage(file);
            return ResponseEntity.ok(Map.of("url", mediaUrl));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Image upload failed."));
        }
    }
}


@Controller
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private ChatMessageRepository chatMessageRepository;

    @Autowired
    private ConversationRepository conversationRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    // --- WebSocket: Send Text/Image Message (Status: DELIVERED) ---
    // Endpoint: /app/chat
    @MessageMapping("/chat")
    public void processMessage(@Payload ChatMessage chatMessage, Principal principal) {
        try {
            chatMessage.setTimestamp(Instant.now());
            // Message is DELIVERED to the server immediately
            chatMessage.setStatus(ChatMessage.MessageStatus.DELIVERED); 

            long minId = Math.min(chatMessage.getSenderId(), chatMessage.getRecipientId());
            long maxId = Math.max(chatMessage.getSenderId(), chatMessage.getRecipientId());
            String conversationId = minId + "_" + maxId;
            chatMessage.setConversationId(conversationId);

            // 1. Save Message to MongoDB
            ChatMessage savedMsg = chatMessageRepository.save(chatMessage);

            // 2. Update Conversation Document (for sidebar, updates recipient unread count)
            updateConversation(conversationId, savedMsg.getSenderId(), savedMsg.getRecipientId(), savedMsg.getContent(), savedMsg.getTimestamp(), savedMsg.getId());

            // 3. Push to Recipient (Status: DELIVERED)
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(chatMessage.getRecipientId()),
                    "/queue/messages",
                    savedMsg
            );
            
            // 4. Push Echo to Sender (to confirm DB ID/Timestamp)
             messagingTemplate.convertAndSendToUser(
                    String.valueOf(chatMessage.getSenderId()),
                    "/queue/messages",
                    savedMsg
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }
    
    // --- WebSocket: Typing Indicator ---
    // Endpoint: /app/chat.typing
    @MessageMapping("/chat.typing")
    public void sendTypingIndicator(@Payload ChatMessage typingIndicator) {
        // Send TYPING event to the recipient only
        typingIndicator.setType(ChatMessage.MessageType.TYPING);
        
        // This is where the typing indicator is broadcast
        messagingTemplate.convertAndSendToUser(
            String.valueOf(typingIndicator.getRecipientId()),
            "/queue/messages",
            typingIndicator
        );
    }
    
    // --- WebSocket: Read Acknowledgement (Read Receipt) ---
    // Endpoint: /app/chat.read-ack
    @MessageMapping("/chat.read-ack")
    public void processReadAck(@Payload ChatMessage ackMessage) {
        try {
            // ackMessage contains: messageId (last one read), readerId (current user), originalSenderId (the one who sent the message)
            Long readerId = ackMessage.getReaderId();
            Long originalSenderId = ackMessage.getOriginalSenderId();
            String lastReadMsgId = ackMessage.getMessageId();
            
            long minId = Math.min(readerId, originalSenderId);
            long maxId = Math.max(readerId, originalSenderId);
            String conversationId = minId + "_" + maxId;
            
            Optional<Conversation> convOpt = conversationRepository.findById(conversationId);

            if (convOpt.isPresent()) {
                 Conversation conv = convOpt.get();
                 
                 // 1. Find the last read message by ID and update the status of ALL messages up to that point
                 chatMessageRepository.findById(lastReadMsgId).ifPresent(lastReadMsg -> {
                     chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId).stream()
                         .filter(m -> m.getSenderId().equals(originalSenderId) && m.getRecipientId().equals(readerId) 
                                     && (m.getTimestamp().equals(lastReadMsg.getTimestamp()) || m.getTimestamp().isBefore(lastReadMsg.getTimestamp()))
                                     && m.getStatus() != ChatMessage.MessageStatus.READ)
                         .forEach(m -> {
                             m.setStatus(ChatMessage.MessageStatus.READ);
                             chatMessageRepository.save(m);
                         });
                 });
                 
                 // 2. Update Conversation document for Unread Counter and LastReadMessageId
                 conv.getUnreadCounts().put(String.valueOf(readerId), 0);
                 
                 if (conv.getLastReadMessageIds() == null) {
                     conv.setLastReadMessageIds(new HashMap<>());
                 }
                 // The reader saves the ID of the message they just read (which was sent by originalSenderId)
                 conv.getLastReadMessageIds().put(String.valueOf(readerId), lastReadMsgId);
                 
                 conversationRepository.save(conv);
            }
            
            // 3. Notify the Original Sender (Recipient of this ACK) so they update their ticks
            // The sender needs the new 'READ' status to update their UI
            ChatMessage readReceipt = new ChatMessage();
            readReceipt.setId(lastReadMsgId); 
            readReceipt.setSenderId(readerId); // Who read it
            readReceipt.setOriginalSenderId(originalSenderId); // Who sent the original message
            readReceipt.setType(ChatMessage.MessageType.READ_ACK);
            
            messagingTemplate.convertAndSendToUser(
                    String.valueOf(originalSenderId),
                    "/queue/messages",
                    readReceipt
            );

        } catch (Exception e) {
            e.printStackTrace();
        }
    }


    // --- REST: Get Chat History (Invoked when chat window opens) ---
    public Map<String, Object> getChatHistory(Long senderId, Long recipientId) {
        long minId = Math.min(senderId, recipientId);
        long maxId = Math.max(senderId, recipientId);
        String conversationId = minId + "_" + maxId;
        
        List<ChatMessage> messages = chatMessageRepository.findByConversationIdOrderByTimestampAsc(conversationId);
        
        // Find the first unread message from the recipient to the sender
        String firstUnreadId = messages.stream()
            .filter(m -> m.getSenderId().equals(recipientId) && m.getRecipientId().equals(senderId) && m.getStatus() != ChatMessage.MessageStatus.READ)
            .map(ChatMessage::getId)
            .findFirst()
            .orElse(null);

        // Map for response (messages, and metadata for UI rendering)
        Map<String, Object> response = new HashMap<>();
        response.put("messages", messages);
        response.put("firstUnreadId", firstUnreadId); // Used for the "Unread Messages" separator

        // Important: Update the Conversation document for the sender (current user)
        // This ensures the sidebar count is clear and the lastReadId is correct for the other person
        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        convOpt.ifPresent(conv -> {
            conv.getUnreadCounts().put(String.valueOf(senderId), 0);
            
            if (!messages.isEmpty()) {
                // Since the user is viewing the chat, the last message they received is now the last message they read
                // We only mark the last received message as read in the conversation metadata if it was sent by the *other user*
                ChatMessage lastReceivedMsg = messages.stream()
                    .filter(m -> m.getSenderId().equals(recipientId) && m.getRecipientId().equals(senderId))
                    .reduce((a, b) -> b) // Get the last element
                    .orElse(null);
                
                if (lastReceivedMsg != null) {
                    if (conv.getLastReadMessageIds() == null) {
                        conv.setLastReadMessageIds(new HashMap<>());
                    }
                    // Mark the latest message in the thread as read by the current user (senderId)
                    conv.getLastReadMessageIds().put(String.valueOf(senderId), lastReceivedMsg.getId());
                }
            }
            
            conversationRepository.save(conv);
        });
        
        return response;
    }

    // --- REST: Get Conversations List (Sidebar) ---
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
                
                Integer unread = conv.getUnreadCounts() != null ? conv.getUnreadCounts().get(String.valueOf(userId)) : 0;
                dto.put("unread", unread == null ? 0 : unread);
                
                // Mock online status (replace with actual logic if available)
                dto.put("online", Math.random() > 0.5); 
                
                result.add(dto);
            }
        }
        
        result.sort((a, b) -> ((Instant) b.get("timestamp")).compareTo((Instant) a.get("timestamp")));
        
        return result;
    }

    // --- Helper: Update Conversation (Centralized Logic) ---
    private void updateConversation(String conversationId, Long senderId, Long recipientId, String content, Instant timestamp, String messageId) {
        Optional<Conversation> convOpt = conversationRepository.findById(conversationId);
        Conversation conv;
        
        if (convOpt.isPresent()) {
            conv = convOpt.get();
        } else {
            conv = new Conversation();
            conv.setId(conversationId);
            conv.setParticipants(Arrays.asList(senderId, recipientId));
            conv.setUnreadCounts(new HashMap<>());
            conv.setLastReadMessageIds(new HashMap<>());
        }

        // Update Last Message
        Conversation.LastMessage lastMsg = new Conversation.LastMessage(
                senderId,
                content,
                timestamp
        );
        conv.setLastMessage(lastMsg);

        // Increment Unread Count for Recipient
        Map<String, Integer> counts = conv.getUnreadCounts();
        String recipientKey = String.valueOf(recipientId);
        counts.put(recipientKey, counts.getOrDefault(recipientKey, 0) + 1);
        conv.setUnreadCounts(counts);

        conversationRepository.save(conv);
    }
}