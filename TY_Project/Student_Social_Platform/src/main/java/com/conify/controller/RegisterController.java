package com.conify.controller;

import com.conify.dto.RegisterDTO;
import com.conify.dto.CheckUserDTO; // <-- NEW IMPORT
import com.conify.service.RegisterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RegisterController {

    @Autowired
    private RegisterService registerService;

    // --- NEW METHOD for Pre-Validation ---
    @PostMapping("/check-user")
    public ResponseEntity<Map<String, String>> checkUser(@RequestBody CheckUserDTO checkUserDTO) {
        Map<String, String> response = new HashMap<>();
        try {
            // This service method will throw an exception if user is found
            registerService.checkUserExists(checkUserDTO);
            
            response.put("status", "success");
            response.put("message", "User is available");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            // Handle errors (like duplicate email/username)
            response.put("status", "error");
            response.put("message", e.getMessage());
            // 409 Conflict is the correct code for "already exists"
            return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
        }
    }
    // --- End of new method ---


    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody RegisterDTO registerDTO) {
        Map<String, String> response = new HashMap<>();
        try {
            // This is the FINAL registration call
            String successMessage = registerService.registerUser(registerDTO);
            
            response.put("status", "success");
            response.put("message", successMessage);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", e.getMessage());
            
            if (e.getMessage().contains("already registered") || e.getMessage().contains("already taken")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}