package com.conify.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.Map;

@Controller
public class TypingController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // ===============================
    // 1-TO-1 CHAT TYPING (UNCHANGED)
    // ===============================
    @MessageMapping("/chat.typing")
    public void handleChatTyping(
            @Payload Map<String, Object> payload,
            Principal principal
    ) {
        if (principal == null) return;

        try {
            Long senderId = Long.valueOf(principal.getName());
            Long recipientId = Long.valueOf(payload.get("recipientId").toString());
            Boolean isTyping = Boolean.valueOf(payload.get("isTyping").toString());

            payload.put("senderId", senderId);
            payload.put("isTyping", isTyping);

            messagingTemplate.convertAndSendToUser(
                    String.valueOf(recipientId),
                    "/queue/typing",
                    payload
            );

        } catch (Exception ignored) {}
    }

    // =================================
    // 🔥 GROUP CHAT TYPING (NEW)
    // =================================
    @MessageMapping("/group.typing")
    public void handleGroupTyping(
            @Payload Map<String, Object> payload,
            Principal principal
    ) {
        if (principal == null) return;

        try {
            Long senderId = Long.valueOf(principal.getName());
            String groupId = payload.get("groupId").toString();
            Boolean isTyping = Boolean.valueOf(payload.get("isTyping").toString());

            payload.put("senderId", senderId);
            payload.put("groupId", groupId);
            payload.put("isTyping", isTyping);

            // 🔥 Broadcast to ALL group subscribers
            messagingTemplate.convertAndSend(
                    "/topic/group/" + groupId + "/typing",
                    payload
            );

        } catch (Exception ignored) {
            // typing must never break socket
        }
    }
}
