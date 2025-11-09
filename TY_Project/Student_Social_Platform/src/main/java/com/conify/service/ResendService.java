package com.conify.service;

import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.LocalDateTime; 
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