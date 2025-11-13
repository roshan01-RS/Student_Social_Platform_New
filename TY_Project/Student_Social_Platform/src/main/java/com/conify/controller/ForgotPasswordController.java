package com.conify.controller;

import com.conify.dto.ForgotPasswordDTO;
import com.conify.dto.ResetPasswordDTO;
import com.conify.dto.VerifyDTO;
import com.conify.service.ForgotPasswordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// --- NEW IMPORTS ---
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
// --- END NEW IMPORTS ---

import java.util.Map;

@RestController
@RequestMapping("/api/forgot-password")
public class ForgotPasswordController {

    @Autowired
    private ForgotPasswordService forgotPasswordService;

    // --- NO CHANGE TO THIS METHOD ---
    @PostMapping("/initiate")
    public ResponseEntity<Map<String, String>> initiateReset(@RequestBody ForgotPasswordDTO dto) {
        try {
            forgotPasswordService.initiateReset(dto);
            return ResponseEntity.ok(Map.of("status", "success", "message", "OTP sent to your email."));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    // --- FIXED: This method now sets the cookie ---
    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verifyOtp(@RequestBody VerifyDTO dto, HttpServletResponse httpResponse) {
        try {
            forgotPasswordService.verifyResetOtp(dto);
            
            // 1. Create a secure, HttpOnly cookie for the reset token (the OTP)
            Cookie cookie = new Cookie("pwResetToken", dto.getOtp());
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(5 * 60); // 5 minute expiry
            // cookie.setSecure(true); // Uncomment in production (HTTPS)
            
            // 2. Add the cookie to the response
            httpResponse.addCookie(cookie);

            return ResponseEntity.ok(Map.of("status", "success", "message", "OTP verified."));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    // --- FIXED: This method now reads the cookie ---
    @PostMapping("/reset")
    public ResponseEntity<Map<String, String>> resetPassword(
            @RequestBody ResetPasswordDTO dto, 
            @CookieValue(name = "pwResetToken", required = false) String token,
            HttpServletResponse httpResponse) {
        
        try {
            if (token == null) {
                throw new Exception("No reset token found. Please verify your OTP again.");
            }

            // 1. Pass the token and new password to the service
            forgotPasswordService.resetPassword(token, dto.getNewPassword());

            // 2. Clear the cookie upon success
            Cookie cookie = new Cookie("pwResetToken", null);
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(0);
            // cookie.setSecure(true); // Uncomment in production
            httpResponse.addCookie(cookie);

            return ResponseEntity.ok(Map.of("status", "success", "message", "Password has been reset successfully."));
            
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}