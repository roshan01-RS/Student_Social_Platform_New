package com.conify.controller;

import com.conify.dto.RegisterDTO;
import com.conify.service.RegisterService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
// @CrossOrigin(origins = "http://127.0.0.1:5500") // Optional: Use if global CorsConfig doesn't work
public class RegisterController {

    @Autowired
    private RegisterService registerService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@RequestBody RegisterDTO registerDTO) {
        Map<String, String> response = new HashMap<>();
        try {
            // Call the service to do the work
            String successMessage = registerService.registerUser(registerDTO);
            
            response.put("status", "success");
            response.put("message", successMessage);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            // Handle errors (like duplicate email)
            response.put("status", "error");
            response.put("message", e.getMessage());
            
            // If it's the "already registered" error, return 409 Conflict
            if (e.getMessage().contains("already registered")) {
                return ResponseEntity.status(HttpStatus.CONFLICT).body(response);
            }
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}