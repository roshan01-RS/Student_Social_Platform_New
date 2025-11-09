package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;

@Service
public class LoginService {

    @Autowired
    private UserRepository userRepository;

    // We use custom exceptions to tell the controller which HTTP code to send
    public static class InvalidCredentialsException extends Exception {
        public InvalidCredentialsException(String message) { super(message); }
    }
    public static class NotVerifiedException extends Exception {
        public NotVerifiedException(String message) { super(message); }
    }

    public String loginUser(LoginDTO loginDTO) throws InvalidCredentialsException, NotVerifiedException {
        // 1. Find user by email (using the Repository magic)
        Optional<User> userOpt = userRepository.findByEmail(loginDTO.getEmail());

        if (userOpt.isEmpty()) {
            // User not found
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        User user = userOpt.get();

        // 2. Verify Password
        BCrypt.Result result = BCrypt.verifyer().verify(loginDTO.getPassword().toCharArray(), user.getPasswordHash());
        if (!result.verified) {
            // Wrong password (same error message for security)
            throw new InvalidCredentialsException("Invalid email or password.");
        }

        // 3. Check Verification Status
        if (user.getIsVerified() == 0) {
            throw new NotVerifiedException("Account not verified. Please check email for OTP.");
        }

        return "Login successful.";
    }
}