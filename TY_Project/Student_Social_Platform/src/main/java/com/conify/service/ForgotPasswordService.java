package com.conify.service;

import com.conify.dto.ResetPasswordDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Random;

@Service
public class ForgotPasswordService {

    @Autowired private UserRepository userRepository;
    @Autowired private EmailService emailService;

    // 1. Initiate: Generate OTP and send email
    public void initiateForgotPassword(String email) throws Exception {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new Exception("Email not found."));

        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);
        user.setResetToken(otp);
        // Set expiry to 5 minutes from now
        user.setResetTokenExpiry(Timestamp.from(Instant.now().plusSeconds(300)));
        userRepository.save(user);

        emailService.sendEmail(email, "Reset Your Password", "Your password reset code is: " + otp);
    }

    // 2. Verify: Check if OTP is valid (used by otp.js)
    public void verifyResetOtp(String email, String otp) throws Exception {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new Exception("User not found."));

        if (user.getResetToken() == null || !user.getResetToken().equals(otp)) {
            throw new Exception("Invalid reset code.");
        }
        if (user.getResetTokenExpiry().before(Timestamp.from(Instant.now()))) {
            throw new Exception("Reset code has expired.");
        }
    }

    // 3. Reset: Finalize with new password
    public void resetPassword(ResetPasswordDTO dto) throws Exception {
        // Re-verify OTP just to be secure
        verifyResetOtp(dto.getEmail(), dto.getOtp());

        User user = userRepository.findByEmail(dto.getEmail()).get();
        // Hash new password
        String newHash = BCrypt.withDefaults().hashToString(12, dto.getNewPassword().toCharArray());
        user.setPasswordHash(newHash);
        // Clear reset token so it can't be used again
        user.setResetToken(null);
        user.setResetTokenExpiry(null);
        
        userRepository.save(user);
    }
}