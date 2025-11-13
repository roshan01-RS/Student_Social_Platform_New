package com.conify.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class LogoutController {

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(HttpServletResponse httpResponse) {
        // Create a new cookie with the same name that expires immediately
        Cookie cookie = new Cookie("authToken", null);
        cookie.setHttpOnly(true);
        cookie.setPath("/");
        cookie.setMaxAge(0); // This tells the browser to delete it
        // cookie.setSecure(true); // Use in production

        httpResponse.addCookie(cookie);

        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }
}