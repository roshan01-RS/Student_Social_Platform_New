package com.conify.controller;

import com.conify.dto.LoginDTO;
import com.conify.service.LoginService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api")
public class LoginController {

    @Autowired
    private LoginService loginService;

    @PostMapping("/login")
    public ResponseEntity<Map<String, String>> login(
            @RequestBody LoginDTO dto,
            HttpServletRequest request,
            HttpServletResponse response) {

        try {
            String ip = request.getHeader("X-Forwarded-For");
            if (ip == null || ip.isBlank()) ip = request.getRemoteAddr();

            String token = loginService.loginUser(dto, ip).get("token");

            Cookie cookie = new Cookie("authToken", token);
            cookie.setHttpOnly(true);
            cookie.setSecure(false); // set TRUE in production (HTTPS)
            cookie.setPath("/");
            cookie.setMaxAge(24 * 60 * 60);
            cookie.setAttribute("SameSite", "Strict");

            response.addCookie(cookie);

            return ResponseEntity.ok(Map.of(
                    "status", "success",
                    "message", "Login successful"
            ));

        } catch (LoginService.InvalidCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("status", "error", "message", e.getMessage()));

        } catch (LoginService.NotVerifiedException e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("status", "unverified", "message", e.getMessage()));

        } catch (CannotAcquireLockException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("status", "error", "message", "System busy. Try again."));

        } catch (Exception e) {
            e.printStackTrace(); // REQUIRED for fuzzing visibility
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", "Internal error"));
        }
    }
}
