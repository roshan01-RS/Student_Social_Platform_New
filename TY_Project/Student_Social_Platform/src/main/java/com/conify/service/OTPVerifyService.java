package com.conify.service;

import com.conify.dto.OTPVerifyDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;

@Service
public class OTPVerifyService {

    private static final int OTP_EXPIRATION_MINUTES = 5;

    @Autowired
    private UserRepository userRepository;

    /**
     * Custom exception for clean controller-level error handling
     */
    public static class OTPVerificationException extends Exception {
        public OTPVerificationException(String message) {
            super(message);
        }
    }

    @Retryable(
        retryFor = CannotAcquireLockException.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000)
    )
    @Transactional
    public String verifyUser(OTPVerifyDTO verifyDTO) throws OTPVerificationException {

        // 1. Find user by email
        Optional<User> userOpt = userRepository.findByEmail(verifyDTO.getEmail());
        if (userOpt.isEmpty()) {
            throw new OTPVerificationException("Email not found. Please register first.");
        }

        User user = userOpt.get();

        // 2. Already verified check
        if (user.getIsVerified() == 1) {
            return "Account already verified. You can login.";
        }

        // 3. OTP expiration check
        Timestamp createdAt = user.getOtpCreatedAt();
        if (createdAt == null ||
            Instant.now().isAfter(createdAt.toInstant().plusSeconds(OTP_EXPIRATION_MINUTES * 60))) {
            throw new OTPVerificationException("Your OTP has expired. Please request a new one.");
        }

        // 4. OTP match check
        if (user.getOtp() != null && user.getOtp().equals(verifyDTO.getOtp())) {

            user.setIsVerified(1);
            user.setOtp(null);
            user.setOtpCreatedAt(null);
            user.setRegistrationSuccessfulAt(new Timestamp(System.currentTimeMillis()));

            userRepository.save(user);
            return "OTP verified! Your account is now active.";

        } else {
            throw new OTPVerificationException("Invalid OTP. Please check your email and try again.");
        }
    }
}
