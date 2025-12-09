package com.conify.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // /topic = Public channels (for broadcasts, like logout alerts or group messages)
        // /queue = Private channels (for 1-on-1 chats and user-specific notifications)
        config.enableSimpleBroker("/topic", "/queue");
        // /app is the prefix for endpoints handled by @MessageMapping (like /app/chat)
        config.setApplicationDestinationPrefixes("/app");
        // /user ensures private messages route to /user/{userId}/queue/*
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // /ws is the WebSocket handshake endpoint for SockJS clients
        registry.addEndpoint("/ws")
                // Allow all origins (*) for flexible testing/deployment.
                .setAllowedOriginPatterns("*") 
                .withSockJS();
    }
}