package com.conify.service;

import com.conify.dto.ForgotPasswordDTO;
import com.conify.dto.VerifyDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import at.favre.lib.crypto.bcrypt.BCrypt;

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

    @Transactional
    public void initiateReset(ForgotPasswordDTO dto) throws Exception {
        String email = dto.getEmail().toLowerCase();
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new Exception("No account found with that email."));

        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);
        
        user.setResetToken(otp);
        user.setResetTokenExpiry(Timestamp.valueOf(LocalDateTime.now().plusMinutes(15)));
        userRepository.save(user);

        String emailSubject = "Your Conify Password Reset Code";
        // --- FIXED: Changed emailBody to be HTML ---
        String emailBody = "<p style=\"font-size: 18px; margin-bottom: 24px;\">Hi " + user.getUsername() + ",</p>"
                         + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">Your 4-digit password reset code is:</p>"
                         + "<h2 style=\"font-size: 36px; color: white; letter-spacing: 4px; margin: 0 auto 24px auto; background-color: #374151; padding: 12px; border-radius: 12px; text-align: center; width: 150px;\">"
                         + otp
                         + "</h2>"
                         + "<p style=\"color: #9ca3af; font-size: 14px;\">This code will expire in 15 minutes.</p>";
        
        emailService.sendEmail(user.getEmail(), emailSubject, emailBody);
    }

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
    }

    @Transactional
    public void resetPassword(String token, String newPassword) throws Exception {
        
        User user = userRepository.findByResetToken(token)
                .orElseThrow(() -> new Exception("Invalid or expired reset token."));

        if (user.getResetTokenExpiry().before(Timestamp.valueOf(LocalDateTime.now()))) {
            throw new Exception("Your reset token has expired. Please try again.");
        }

        String newPasswordHash = BCrypt.withDefaults().hashToString(12, newPassword.toCharArray());

        user.setPasswordHash(newPasswordHash);
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        userRepository.save(user);
    }
}