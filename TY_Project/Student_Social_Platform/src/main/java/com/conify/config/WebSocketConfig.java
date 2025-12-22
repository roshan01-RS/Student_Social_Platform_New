package com.conify.config;

import com.conify.model.User;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Configures WebSocket with a SECURE HandshakeHandler.
 * * SECURITY UPDATE:
 * Instead of trusting the 'userId' query parameter (which allows impersonation),
 * this configuration validates the 'authToken' JWT from the request Cookies.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Public channels and private queues
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                // Pass dependencies to the secure handler
                .setHandshakeHandler(new SecureHandshakeHandler(jwtUtil, userRepository))
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    /**
     * Secure HandshakeHandler:
     * Extracts identity from the 'authToken' cookie. 
     * Fallback to anonymous if token is missing or invalid.
     */
    private static class SecureHandshakeHandler extends DefaultHandshakeHandler {
        
        private final JwtUtil jwtUtil;
        private final UserRepository userRepository;

        public SecureHandshakeHandler(JwtUtil jwtUtil, UserRepository userRepository) {
            this.jwtUtil = jwtUtil;
            this.userRepository = userRepository;
        }

        @Override
        protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler, Map<String, Object> attributes) {
            try {
                // 1. Extract Token from Cookie Header (safer than query params)
                List<String> cookieHeaders = request.getHeaders().get("Cookie");
                String token = null;

                if (cookieHeaders != null) {
                    for (String header : cookieHeaders) {
                        String[] cookies = header.split(";");
                        for (String cookie : cookies) {
                            cookie = cookie.trim();
                            if (cookie.startsWith("authToken=")) {
                                token = cookie.substring("authToken=".length());
                                break;
                            }
                        }
                        if (token != null) break;
                    }
                }

                // 2. Validate Token & Set Principal
                if (token != null && jwtUtil.validateToken(token)) {
                    String username = jwtUtil.getUsernameFromToken(token);
                    Optional<User> userOpt = userRepository.findByUsername(username);
                    
                    if (userOpt.isPresent()) {
                        // Return the REAL authenticated User ID
                        final String principalName = String.valueOf(userOpt.get().getId());
                        return () -> principalName;
                    }
                }
            } catch (Exception ex) {
                // Validation failed, proceed to fallback
            }

            // Fallback: Assign random ID to prevent session conflict, but user will have NO access to private queues
            final String fallback = "anon-" + UUID.randomUUID();
            return () -> fallback;
        }
    }
}