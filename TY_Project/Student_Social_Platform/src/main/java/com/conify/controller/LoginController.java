package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginDTO loginDTO, HttpServletResponse httpResponse) {
        
        try {
            Map<String, String> serviceResponse = loginService.loginUser(loginDTO);
            String token = serviceResponse.get("token");

            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(24 * 60 * 60); // 1 day
            // cookie.setSecure(true); // Use in production (HTTPS)
            
            httpResponse.addCookie(cookie);

            // --- THIS IS THE FIX ---
            // We must add the "status: success" to the JSON response
            // so the frontend knows to redirect.
            Map<String, String> jsonResponse = new HashMap<>();
            jsonResponse.put("status", "success");
            jsonResponse.put("message", "Login successful.");
            
            return ResponseEntity.ok(jsonResponse);

        } catch (LoginService.InvalidCredentialsException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(response);

        } catch (LoginService.NotVerifiedException e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "unverified"); 
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(response);

        } catch (Exception e) {
            Map<String, String> response = new HashMap<>();
            response.put("status", "error");
            response.put("message", "Login failed due to server error.");
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}