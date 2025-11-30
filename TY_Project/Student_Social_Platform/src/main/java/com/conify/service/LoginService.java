package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil; // <-- FIXED: This path is now correct
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;
import java.sql.Timestamp; 
import java.time.LocalDateTime; 
import java.time.format.DateTimeFormatter; 

// Imports for Retry Logic
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private EmailService emailService; // For welcome email

    // Custom exceptions
    public static class InvalidCredentialsException extends Exception {
        public InvalidCredentialsException(String message) { super(message); }
    }
    public static class NotVerifiedException extends Exception {
        public NotVerifiedException(String message) { super(message); }
    }

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public Map<String, String> loginUser(LoginDTO loginDTO) throws InvalidCredentialsException, NotVerifiedException {
        
        String identifier = loginDTO.getIdentifier(); 
        String password = loginDTO.getPassword();

        Optional<User> userOpt;

        if (identifier.contains("@")) {
            userOpt = userRepository.findByEmailIgnoreCase(identifier);
        } else {
            userOpt = userRepository.findByUsernameIgnoreCase(identifier);
        }

        if (userOpt.isEmpty()) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        User user = userOpt.get();

        BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), user.getPasswordHash());
        if (!result.verified) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        if (user.getIsVerified() == 0) {
            throw new NotVerifiedException("Account not verified. Please check email for OTP.");
        }
        
        LocalDateTime loginTime = LocalDateTime.now();
        if (user.getLastLoginAt() == null) {
            try {
                String formattedTime = loginTime.format(DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a"));
                String subject = "Welcome to Conify, " + user.getUsername() + "!";
                
                // --- FIXED: Changed body to be HTML ---
                String body = "<p style=\"font-size: 18px; margin-bottom: 24px;\">Hi " + user.getUsername() + ",</p>"
                            + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">Welcome to Conify! We're thrilled to have you on board.</p>"
                            + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">You successfully logged in for the first time on: " + formattedTime + "</p>"
                            + "<p style=\"color: #e5e7eb;\">Enjoy connecting!<br/>- The Conify Team</p>";
                
                emailService.sendEmail(user.getEmail(), subject, body);
            } catch (Exception e) {
                System.err.println("CRITICAL: Failed to send WELCOME email to " + user.getEmail() + ": " + e.getMessage());
            }
        }
        
        user.setLastLoginAt(Timestamp.valueOf(loginTime));
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Login successful.");
        response.put("token", token);
        
        return response;
    }
}