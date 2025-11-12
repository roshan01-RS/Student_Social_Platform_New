package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil; // Assuming JwtUtil is in 'com.conify.util'
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;

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
    private JwtUtil jwtUtil; // Make sure you have this bean defined

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

        // 1. Find user by email OR username, ignoring case
        Optional<User> userOpt = userRepository.findByEmailOrUsernameIgnoreCase(identifier);

        if (userOpt.isEmpty()) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        User user = userOpt.get();

        // 2. Verify Password
        BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), user.getPasswordHash());
        if (!result.verified) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        // 3. Check Verification Status
        if (user.getIsVerified() == 0) {
            throw new NotVerifiedException("Account not verified. Please check email for OTP.");
        }

        // 4. Generate JWT Token
        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        // 5. Build and return response map
        Map<String, String> response = new HashMap<>();
        response.put("message", "Login successful.");
        response.put("token", token);
        
        return response;
    }
}