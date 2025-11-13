package com.conify.service;

import com.conify.dto.RegisterDTO;
import com.conify.dto.CheckUserDTO; // <-- NEW IMPORT
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
import java.time.LocalDate; // <-- NEW IMPORT
import java.time.LocalDateTime;
import java.time.Period; // <-- NEW IMPORT
import java.util.Random;

@Service
public class RegisterService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService; // Assuming EmailService exists

    // --- NEW METHOD for Pre-Validation ---
    @Transactional(readOnly = true) // This is a read-only check
    public void checkUserExists(CheckUserDTO checkUserDTO) throws Exception {
        String lowercaseEmail = checkUserDTO.getEmail().toLowerCase();
        String lowercaseUsername = checkUserDTO.getUsername().toLowerCase();

        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered. Please log in.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken. Please choose another.");
        }
        // If no exception is thrown, the user is available
    }
    // --- End of new method ---

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public String registerUser(RegisterDTO registerDTO) throws Exception {
        
        String lowercaseEmail = registerDTO.getEmail().toLowerCase();
        String lowercaseUsername = registerDTO.getUsername().toLowerCase();

        // 1. Final check (in case user signed up on another tab)
        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken.");
        }

        // --- NEW: Birthday Validation ---
        if (registerDTO.getBirthday() == null || registerDTO.getBirthday().isEmpty()) {
            throw new Exception("Birthday is required.");
        }
        
        LocalDate birthDate = LocalDate.parse(registerDTO.getBirthday()); // Parses "YYYY-MM-DD"
        int age = Period.between(birthDate, LocalDate.now()).getYears();

        if (age < 11) {
            throw new Exception("You must be at least 11 years old to register.");
        }
        // --- End of Birthday Validation ---


        // 3. Hash password
        String hashedPassword = BCrypt.withDefaults().hashToString(12, registerDTO.getPassword().toCharArray());

        // 4. Generate OTP
        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);

        // 5. Date and Expiry Logic
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiryDate = now.plusYears(1); // Add exactly one year

        // 6. Create new User entity
        User newUser = new User();
        newUser.setUsername(lowercaseUsername); 
        newUser.setEmail(lowercaseEmail); 
        newUser.setPasswordHash(hashedPassword);
        newUser.setSchoolName(registerDTO.getSchool()); 
        newUser.setBirthday(birthDate); // <-- ADDED
        newUser.setOtp(otp);
        newUser.setIsVerified(0);
        
        newUser.setOtpCreatedAt(Timestamp.valueOf(now));
        newUser.setRegistrationSuccessfulAt(Timestamp.valueOf(now)); 
        newUser.setAccountExpireDate(Timestamp.valueOf(expiryDate)); 
        newUser.setLastLoginAt(null); // Explicitly set last login to null

        // 7. Save to DB
        userRepository.save(newUser);

        // 8. Send Email
        String emailSubject = "Your Conify Verification Code";
        String emailBody = "Welcome to Conify! Your 4-digit verification code is: " + otp;
        
        emailService.sendEmail(newUser.getEmail(), emailSubject, emailBody);

        return "OTP sent to " + newUser.getEmail();
    }
}