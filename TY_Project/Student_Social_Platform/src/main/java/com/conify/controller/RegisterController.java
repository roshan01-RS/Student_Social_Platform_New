package com.conify.controller;

import com.conify.dto.RegisterDTO;
import com.conify.dto.CheckUserDTO; 
import com.conify.service.RegisterService;
import com.conify.repository.mongo.UserProfileRepository; // New Import
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
// --- NEW IMPORT ---
import org.springframework.dao.CannotAcquireLockException;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class RegisterController {

    @Autowired
    private RegisterService registerService;
    
    // Inject Mongo Repository directly here for extra safety check in controller if desired,
    // although optimal design puts this logic in the Service layer (which I see you have updated in RegisterService).
    // However, since you asked to update this specific file to fetch both:
    @Autowired
    private UserProfileRepository userProfileRepository; 

    // --- NEW METHOD for Pre-Validation ---
    @PostMapping("/check-user")
    public ResponseEntity<Map<String, String>> checkUser(@RequestBody CheckUserDTO checkUserDTO) {
        Map<String, String> response = new HashMap<>();
        try {
            // 1. Check MongoDB First (User Profiles)
            String username = checkUserDTO.getUsername();
            if (userProfileRepository.findByUsername(username).isPresent() || 
                userProfileRepository.findByUsername("@" + username).isPresent()) {
                throw new Exception("Username is taken (Profile exists).");
            }
            // Note: findByEmail needs to be added to UserProfileRepository interface if not present
            // Assuming we want to check it:
            // if (userProfileRepository.findByEmail(checkUserDTO.getEmail()).isPresent()) { ... }

            // 2. Check SQLite (via Service)
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

        } catch (CannotAcquireLockException e) {
            // Handle DB locking issues gracefully
            response.put("status", "error");
            response.put("message", "System is busy. Please try again in a moment.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);

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