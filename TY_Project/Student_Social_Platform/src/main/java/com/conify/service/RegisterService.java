package com.conify.service;

import com.conify.dto.RegisterDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Random;

@Service
public class RegisterService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    public String registerUser(RegisterDTO registerDTO) throws Exception {
        // 1. Check if user exists
        if (userRepository.existsByEmail(registerDTO.getEmail())) {
            throw new Exception("This email is already registered. Please log in.");
        }

        // check if username exists
        if (userRepository.existsByUsername(registerDTO.getUsername())) {
            throw new Exception("This username is already taken. Please choose another.");
        }

        // 2. Hash password
        String hashedPassword = BCrypt.withDefaults().hashToString(12, registerDTO.getPassword().toCharArray());

        // 3. Generate OTP
        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);

        // 4. Create new User entity
        User newUser = new User();
        newUser.setUsername(registerDTO.getUsername());
        newUser.setEmail(registerDTO.getEmail());
        newUser.setPasswordHash(hashedPassword);
        newUser.setOtp(otp);
        newUser.setOtpCreatedAt(Timestamp.valueOf(LocalDateTime.now()));
        newUser.setIsVerified(0);

        // 5. Save to DB (No need for manual transactions or locks, Spring handles it)
        userRepository.save(newUser);

        // 6. Send Email
        String emailSubject = "Your Conify Verification Code";
        String emailBody = "Welcome to Conify! Your 4-digit verification code is: " + otp;
        
        // Note: Your EmailService needs the @Service annotation to be Autowired here.
        boolean emailSent = emailService.sendEmail(newUser.getEmail(), emailSubject, emailBody);
        
        if (!emailSent) {
             System.err.println("WARNING: Email failed to send for " + newUser.getEmail());
             // Optional: You could throw an exception here to rollback the DB save if desired.
        }

        return "OTP sent to " + newUser.getEmail();
    }
}