package com.conify.service;

import com.conify.dto.VerifyDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

@Service
public class VerifyService {

    private static final int OTP_EXPIRATION_MINUTES = 5;

    @Autowired
    private UserRepository userRepository;

    // Custom exception for cleaner controller error handling
    public static class VerificationException extends Exception {
        public VerificationException(String message) { super(message); }
    }

    @Transactional // Ensures the read-update-save happens safely together
    public String verifyUser(VerifyDTO verifyDTO) throws VerificationException {
        // 1. Find the user
        Optional<User> userOpt = userRepository.findByEmail(verifyDTO.getEmail());
        if (userOpt.isEmpty()) {
            throw new VerificationException("Email not found. Please register first.");
        }
        User user = userOpt.get();

        // 2. Check if already verified
        if (user.getIsVerified() == 1) {
            return "Account already verified. You can login.";
        }

        // 3. Check OTP Expiration
        Timestamp createdAt = user.getOtpCreatedAt();
        if (createdAt == null || 
            Instant.now().isAfter(createdAt.toInstant().plusSeconds(OTP_EXPIRATION_MINUTES * 60))) {
            throw new VerificationException("Your OTP has expired. Please request a new one.");
        }

        // 4. Check OTP match
        if (user.getOtp() != null && user.getOtp().equals(verifyDTO.getOtp())) {
            // --- SUCCESS! Update the user object ---
            user.setIsVerified(1);                                // mark verified
            user.setOtp(null);                                    // clear OTP
            user.setOtpCreatedAt(null);                           // clear OTP timestamp
            user.setRegistrationSuccessfulAt(new Timestamp(System.currentTimeMillis())); // <-- NEW FIELD

            userRepository.save(user);                            // save changes
            return "OTP verified! Your account is now active.";
        } else {
            throw new VerificationException("Invalid OTP. Please check your email and try again.");
        }
    }
}
