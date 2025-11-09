package com.conify.controller;

import com.conify.dto.ForgotPasswordDTO;
import com.conify.dto.ResetPasswordDTO;
import com.conify.dto.VerifyDTO;
import com.conify.service.ForgotPasswordService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/forgot-password")
public class ForgotPasswordController {

    @Autowired private ForgotPasswordService forgotPasswordService;

    @PostMapping("/initiate")
    public ResponseEntity<?> initiate(@RequestBody ForgotPasswordDTO dto) {
        try {
            forgotPasswordService.initiateForgotPassword(dto.getEmail());
            return ResponseEntity.ok(Map.of("status", "success", "message", "Reset code sent if email exists."));
        } catch (Exception e) {
             // For security, don't always reveal if email exists, but for now we will:
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/verify")
    public ResponseEntity<?> verify(@RequestBody VerifyDTO dto) {
        try {
            forgotPasswordService.verifyResetOtp(dto.getEmail(), dto.getOtp());
            return ResponseEntity.ok(Map.of("status", "success", "message", "Code verified."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/reset")
    public ResponseEntity<?> reset(@RequestBody ResetPasswordDTO dto) {
        try {
            forgotPasswordService.resetPassword(dto);
            return ResponseEntity.ok(Map.of("status", "success", "message", "Password changed successfully."));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}