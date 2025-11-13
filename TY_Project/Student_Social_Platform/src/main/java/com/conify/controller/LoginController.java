package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.LoginService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

// --- NEW IMPORTS ---
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
// --- END NEW IMPORTS ---

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    // FIXED: Added HttpServletResponse to the method
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginDTO loginDTO, HttpServletResponse httpResponse) {
        
        try {
            // 1. LoginService now returns a Map containing the token
            Map<String, String> serviceResponse = loginService.loginUser(loginDTO);
            String token = serviceResponse.get("token");

            // 2. Create a secure, HttpOnly cookie
            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true); // Prevents JavaScript from reading it (XSS protection)
            cookie.setPath("/"); // Makes it available to all pages
            cookie.setMaxAge(24 * 60 * 60); // 1 day expiration
            // cookie.setSecure(true); // **IMPORTANT**: Uncomment this in production (when using HTTPS)
                                      // It will not work on http://localhost
            
            // 3. Add the cookie to the HTTP response
            httpResponse.addCookie(cookie);

            // 4. Remove the token from the JSON body (it's now in the cookie)
            serviceResponse.remove("token");
            
            return ResponseEntity.ok(serviceResponse);

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