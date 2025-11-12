package com.conify.service;

import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
// --- NEW IMPORTS FOR RETRY LOGIC ---
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.Random;

@Service
public class ResendService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    // Custom exception to handle cases where the email doesn't exist
    public static class UserNotFoundException extends Exception {
        public UserNotFoundException(String message) { super(message); }
    }

    // Retries up to 3 times if SQLite is busy, waiting 1s between tries
    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public void resendOtp(String email) throws UserNotFoundException {
        // 1. Find the user in the DB
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException("User not found with email: " + email));

        // 2. Generate a completely new 4-digit OTP
        String newOtp = String.format("%04d", new Random().nextInt(9000) + 1000);

        // 3. Update the user entity with the new OTP and CURRENT timestamp
        user.setOtp(newOtp);
        user.setOtpCreatedAt(new Timestamp(System.currentTimeMillis()));

        // 4. Save changes to SQLite
        userRepository.save(user);
        System.out.println("🔄 OTP resent & updated in DB for: " + email);

        // 5. Send the new email
        String emailSubject = "Resend: Your Conify Verification Code";
        String emailBody = "Here is your new verification code: " + newOtp + 
                           "\nIt will expire in 5 minutes.";
        
        emailService.sendEmail(email, emailSubject, emailBody);
    }
}