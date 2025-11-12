package com.conify.service;

import com.conify.dto.RegisterDTO;
import com.conify.model.User;
import com.conify.repository.UserRepository;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Random;

@Service
public class RegisterService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService; // Assuming EmailService exists

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public String registerUser(RegisterDTO registerDTO) throws Exception {
        
        // Convert to lowercase before checking/saving
        String lowercaseEmail = registerDTO.getEmail().toLowerCase();
        String lowercaseUsername = registerDTO.getUsername().toLowerCase();

        // 1. Check if email exists
        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered. Please log in.");
        }

        // 2. Check if username exists
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken. Please choose another.");
        }

        // 3. Hash password
        String hashedPassword = BCrypt.withDefaults().hashToString(12, registerDTO.getPassword().toCharArray());

        // 4. Generate OTP
        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);

        // 5. Create new User entity
        User newUser = new User();
        newUser.setUsername(lowercaseUsername); // Store as lowercase
        newUser.setEmail(lowercaseEmail); // Store as lowercase
        newUser.setPasswordHash(hashedPassword);
        newUser.setSchoolName(registerDTO.getSchool()); // Save school name
        newUser.setOtp(otp);
        newUser.setOtpCreatedAt(Timestamp.valueOf(LocalDateTime.now()));
        newUser.setIsVerified(0);

        // 6. Save to DB
        userRepository.save(newUser);

        // 7. Send Email
        String emailSubject = "Your Conify Verification Code";
        String emailBody = "Welcome to Conify! Your 4-digit verification code is: " + otp;
        
        emailService.sendEmail(newUser.getEmail(), emailSubject, emailBody);

        return "OTP sent to " + newUser.getEmail();
    }
}