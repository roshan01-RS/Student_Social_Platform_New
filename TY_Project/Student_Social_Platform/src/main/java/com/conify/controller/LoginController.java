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
        Map<String, String> response = new HashMap<>();
        try {
            String successMessage = loginService.loginUser(loginDTO);
            
            response.put("status", "success");
            response.put("message", successMessage);
            // In a real app, you might return a JWT token here too
            return ResponseEntity.ok(response);

        } catch (LoginService.InvalidCredentialsException e) {
            // Returns 401 Unauthorized
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);

        } catch (LoginService.NotVerifiedException e) {
            // Returns 403 Forbidden
            response.put("status", "unverified"); // Match your frontend's expected status
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);

        } catch (Exception e) {
            // Returns 500 Internal Server Error for anything else unexpected
            response.put("status", "error");
            response.put("message", "Login failed due to server error.");
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}