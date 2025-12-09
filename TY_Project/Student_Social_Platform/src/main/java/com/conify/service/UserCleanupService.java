package com.conify.service;

import com.conify.repository.UserRepository;
import com.conify.model.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserCleanupService {

    @Autowired
    private UserRepository userRepository;

    private static final int OTP_EXPIRATION_MINUTES = 5;

    // Runs every 60 seconds
    @Scheduled(fixedRate = 60000)
    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public void removeUnverifiedUsers() {
        // 1. Clean Unverified Users (Existing logic)
        Instant fiveMinutesAgo = Instant.now().minusSeconds(OTP_EXPIRATION_MINUTES * 60);
        Timestamp expiryThreshold = Timestamp.from(fiveMinutesAgo);
        userRepository.deleteByIsVerifiedAndOtpCreatedAtBefore(0, expiryThreshold);
        
        // 2. NEW: Clean Expired Password Reset Tokens
        // This addresses your request to clear the token from the DB automatically
        clearExpiredResetTokens();
    }

    private void clearExpiredResetTokens() {
        try {
            Timestamp now = new Timestamp(System.currentTimeMillis());
            
            // Find users with expired tokens that haven't been cleared yet
            // Note: This iterates all users to filter, which is safe for small-medium apps.
            // For large scale, a custom repository method @Query("DELETE FROM User u WHERE ...") is better.
            List<User> allUsers = userRepository.findAll();
            
            List<User> usersWithExpiredTokens = allUsers.stream()
                .filter(u -> u.getResetToken() != null && 
                             u.getResetTokenExpiry() != null && 
                             u.getResetTokenExpiry().before(now))
                .collect(Collectors.toList());

            for(User u : usersWithExpiredTokens) {
                 u.setResetToken(null);
                 u.setResetTokenExpiry(null);
                 userRepository.save(u);
            }
             
        } catch (Exception e) {
            System.err.println("Cleanup error: " + e.getMessage());
        }
    }
}