package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.AdminLoginService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/admin")
public class AdminLoginController {

    @Autowired
    private AdminLoginService adminLoginService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(@RequestBody LoginDTO loginDTO, HttpServletResponse response) {
        Map<String, String> res = new HashMap<>();
        try {
            String token = adminLoginService.authenticateAdmin(loginDTO);

            // Set Admin Cookie (Distinct name to avoid conflict with user authToken)
            Cookie cookie = new Cookie("adminAuthToken", token);
            cookie.setHttpOnly(true);
            cookie.setPath("/");
            cookie.setMaxAge(24 * 60 * 60); // 1 day
            response.addCookie(cookie);

            res.put("status", "success");
            res.put("message", "Admin login successful.");
            return ResponseEntity.ok(res);

        } catch (Exception e) {
            res.put("status", "error");
            res.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(res);
        }
    }

    // NOTE: logout intentionally removed from this controller to avoid duplicate mapping.
    // AdminController contains the single POST /api/admin/logout handler.
}
