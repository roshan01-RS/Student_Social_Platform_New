package com.conify.controller;

import com.conify.service.JwtUtil;
import com.conify.service.LoginService; 
import com.conify.repository.UserRepository;
import com.conify.model.User;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class LogoutController {

    @Autowired
    private LoginService loginService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private UserRepository userRepository;

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            @CookieValue(name = "authToken", required = false) String token,
            HttpServletResponse httpResponse) {
        
        if (token != null && jwtUtil.validateToken(token)) {
            String username = jwtUtil.getUsernameFromToken(token);
            Optional<User> userOpt = userRepository.findByUsername(username);
            if (userOpt.isPresent()) {
                loginService.logoutUser(userOpt.get().getId());
            }
        }

        Cookie cookie = new Cookie("authToken", null);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0); 
        httpResponse.addCookie(cookie);

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}