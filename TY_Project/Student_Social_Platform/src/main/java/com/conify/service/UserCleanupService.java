package com.conify.service;

import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
// --- NEW IMPORTS FOR RETRY LOGIC ---
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;

@Service
public class UserCleanupService {

    @Autowired
    private UserRepository userRepository;

    // How long does a user have to verify? (Matches your frontend timer usually)
    //ISKO 1 SE 5 KARNA HAIN
    private static final int OTP_EXPIRATION_MINUTES = 1;

    // This runs automatically every 60 seconds (fixedRate = 60000ms)
    @Scheduled(fixedRate = 60000)
    // Retries up to 3 times if SQLite is busy, waiting 1s between tries
    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional // Required for delete operations
    public void removeUnverifiedUsers() {
        // Calculate the time 5 minutes ago
        Instant fiveMinutesAgo = Instant.now().minusSeconds(OTP_EXPIRATION_MINUTES * 60);
        Timestamp expiryThreshold = Timestamp.from(fiveMinutesAgo);

        // Delete anyone who is NOT verified (0) AND created BEFORE that threshold
        userRepository.deleteByIsVerifiedAndOtpCreatedAtBefore(0, expiryThreshold);
        
        // Optional: Add a log so you know it's working in the console
        // System.out.println("🧹 Running cleanup: Removed unverified users older than " + fiveMinutesAgo);
    }
}