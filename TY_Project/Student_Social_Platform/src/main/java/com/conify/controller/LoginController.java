package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

// --- NEW IMPORT ---
import org.springframework.dao.CannotAcquireLockException;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginDTO loginDTO, 
                                                     HttpServletRequest request,
                                                     HttpServletResponse httpResponse) {
        
        try {
            // Get IP Address
            String ipAddress = request.getHeader("X-Forwarded-For");
            if (ipAddress == null || ipAddress.isEmpty()) {
                ipAddress = request.getRemoteAddr();
            }

            Map<String, String> serviceResponse = loginService.loginUser(loginDTO, ipAddress);
            String token = serviceResponse.get("token");

            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(24 * 60 * 60); 
            
            httpResponse.addCookie(cookie);

            Map<String, String> jsonResponse = new HashMap<>();
            jsonResponse.put("status", "success");
            jsonResponse.put("message", "Login successful.");
            
            return ResponseEntity.ok(jsonResponse);

        } catch (LoginService.InvalidCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status", "error", "message", e.getMessage()));
        } catch (LoginService.NotVerifiedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("status", "unverified", "message", e.getMessage()));
        
        // --- NEW: Friendly message for DB Locks ---
        } catch (CannotAcquireLockException e) {
            // The user sees this simple message instead of "SQLITE_BUSY"
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "error", "message", "System is busy. Please try again in a few seconds."));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("status", "error", "message", "Login failed."));
        }
    }
}