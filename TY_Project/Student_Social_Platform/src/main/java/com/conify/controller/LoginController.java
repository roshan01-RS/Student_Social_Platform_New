package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginDTO loginDTO) {
        Map<String, String> response; // Declare response map
        try {
            // FIXED: 'serviceResponse' is now a Map that contains the token and message
            Map<String, String> serviceResponse = loginService.loginUser(loginDTO);
            
            // We can use this map directly as our response
            response = serviceResponse; 
            response.put("status", "success");
            
            return ResponseEntity.ok(response);

        } catch (LoginService.InvalidCredentialsException e) {
            response = new HashMap<>(); // Initialize map for error
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);

        } catch (LoginService.NotVerifiedException e) {
            response = new HashMap<>(); // Initialize map for error
            response.put("status", "unverified");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);

        } catch (Exception e) {
            response = new HashMap<>(); // Initialize map for error
            response.put("status", "error");
            response.put("message", "Login failed due to server error.");
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}