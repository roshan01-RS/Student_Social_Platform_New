package com.conify.service;

import com.conify.dto.ForgotPasswordDTO;
import com.conify.dto.VerifyDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import at.favre.lib.crypto.bcrypt.BCrypt; // Keep using this hasher

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Random;

@Service
public class ForgotPasswordService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    // --- NO CHANGES TO THIS METHOD ---
    @Transactional
    public void initiateReset(ForgotPasswordDTO dto) throws Exception {
        String email = dto.getEmail().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new Exception("No account found with that email."));

        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);
        
        user.setResetToken(otp);
        user.setResetTokenExpiry(Timestamp.valueOf(LocalDateTime.now().plusMinutes(15))); // 15 minute expiry
        userRepository.save(user);

        String emailSubject = "Your Conify Password Reset Code";
        String emailBody = "Your 4-digit password reset code is: " + otp + "\nIt will expire in 15 minutes.";
        
        emailService.sendEmail(user.getEmail(), emailSubject, emailBody);
    }

    // --- NO CHANGES TO THIS METHOD ---
    @Transactional(readOnly = true)
    public void verifyResetOtp(VerifyDTO dto) throws Exception {
        User user = userRepository.findByEmail(dto.getEmail().toLowerCase())
                .orElseThrow(() -> new Exception("Invalid email or OTP."));

        if (user.getResetToken() == null || !user.getResetToken().equals(dto.getOtp())) {
            throw new Exception("Invalid email or OTP.");
        }

        if (user.getResetTokenExpiry().before(Timestamp.valueOf(LocalDateTime.now()))) {
            throw new Exception("Your OTP has expired. Please request a new one.");
        }
        // If we reach here, the OTP is valid.
    }

    // --- FIXED: This method is now much simpler ---
    @Transactional
    public void resetPassword(String token, String newPassword) throws Exception {
        
        // 1. Find user by the reset token (which is the OTP)
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new Exception("Invalid or expired reset token."));

        // 2. Check expiry (as a backup)
        if (user.getResetTokenExpiry().before(Timestamp.valueOf(LocalDateTime.now()))) {
            throw new Exception("Your reset token has expired. Please try again.");
        }

        // 3. Hash the new password
        String newPasswordHash = BCrypt.withDefaults().hashToString(12, newPassword.toCharArray());

        // 4. Save new password and clear the token
        user.setPasswordHash(newPasswordHash);
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
    }
}