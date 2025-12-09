package com.conify.service;

import com.conify.dto.RegisterDTO;
import com.conify.dto.CheckUserDTO;
import com.conify.model.User;
import com.conify.model.mongo.UserProfile; 
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.UserProfileRepository; 
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.Period;
import java.time.Instant;
import java.util.Random;

@Service
public class RegisterService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserProfileRepository userProfileRepository; // Injected Mongo Repo

    @Autowired
    private EmailService emailService; 

    @Transactional(readOnly = true)
    public void checkUserExists(CheckUserDTO checkUserDTO) throws Exception {
        String lowercaseEmail = checkUserDTO.getEmail().toLowerCase();
        String lowercaseUsername = checkUserDTO.getUsername().toLowerCase();

        // 1. Check SQLite (Auth DB)
        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered. Please log in.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken. Please choose another.");
        }

        // 2. Check MongoDB (Profile DB) - Extra safety
        if (userProfileRepository.findByUsername(lowercaseUsername).isPresent() || 
            userProfileRepository.findByUsername("@" + lowercaseUsername).isPresent()) {
            throw new Exception("This username is already associated with a profile.");
        }
        
        if (userProfileRepository.findByEmail(lowercaseEmail).isPresent()) {
             throw new Exception("This email is already associated with a profile.");
        }
    }

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public String registerUser(RegisterDTO registerDTO) throws Exception {
        
        String lowercaseEmail = registerDTO.getEmail().toLowerCase();
        String lowercaseUsername = registerDTO.getUsername().toLowerCase();

        // 1. Final check against BOTH databases (Service delegates this responsibility)
        // Note: The controller should have handled the Mongo check before calling this method.
        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken.");
        }

        // 2. Birthday Validation
        if (registerDTO.getBirthday() == null || registerDTO.getBirthday().isEmpty()) {
            throw new Exception("Birthday is required.");
        }
        LocalDate birthDate = LocalDate.parse(registerDTO.getBirthday());
        int age = Period.between(birthDate, LocalDate.now()).getYears();
        if (age < 11) {
            throw new Exception("You must be at least 11 years old to register.");
        }

        // 3. Hash password
        String hashedPassword = BCrypt.withDefaults().hashToString(12, registerDTO.getPassword().toCharArray());

        // 4. Generate OTP
        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);

        // 5. Date and Expiry Logic
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiryDate = now.plusYears(1);

        // 6. Create new User entity
        User newUser = new User();
        newUser.setUsername(lowercaseUsername); 
        newUser.setEmail(lowercaseEmail); 
        newUser.setPasswordHash(hashedPassword);
        newUser.setSchoolName(registerDTO.getSchool()); 
        newUser.setBirthday(birthDate);
        newUser.setOtp(otp);
        newUser.setIsVerified(0);
        newUser.setOtpCreatedAt(Timestamp.valueOf(now));
        newUser.setRegistrationSuccessfulAt(Timestamp.valueOf(now)); 
        newUser.setAccountExpireDate(Timestamp.valueOf(expiryDate)); 
        newUser.setLastLoginAt(null);

        // 7. Save to DB
        User savedUser = userRepository.save(newUser);
        
        // 8. SYNC TO MONGODB IMMEDIATELY (Initial profile creation)
        createMongoProfile(savedUser);

        // 9. Send Email
        String emailSubject = "Your Conify Verification Code";
        String emailBody = "<p style=\"font-size: 18px; margin-bottom: 24px;\">Welcome to Conify!</p>"
                         + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">Your 4-digit verification code is:</p>"
                         + "<h2 style=\"font-size: 36px; color: white; letter-spacing: 4px; margin: 0 auto 24px auto; background-color: #374151; padding: 12px; border-radius: 12px; text-align: center; width: 150px;\">"
                         + otp
                         + "</h2>"
                         + "<p style=\"color: #9ca3af; font-size: 14px;\">This code will expire in 15 minutes.</p>";
        
        emailService.sendEmail(newUser.getEmail(), emailSubject, emailBody);

        return "OTP sent to " + newUser.getEmail();
    }

    private void createMongoProfile(User sqlUser) {
        try {
            UserProfile profile = new UserProfile(sqlUser.getId());
            
            // Add '@' prefix
            String displayUsername = "@" + sqlUser.getUsername();
            
            profile.setUsername(displayUsername);
            profile.setEmail(sqlUser.getEmail());
            profile.setSchoolName(sqlUser.getSchoolName());
            profile.setBirthday(sqlUser.getBirthday());
            profile.setJoinedAt(Instant.now());
            
            // Copy Expire Date
            if (sqlUser.getAccountExpireDate() != null) {
                profile.setAccountExpireDate(sqlUser.getAccountExpireDate().toInstant());
            }

            // Default avatar
            profile.setAvatarUrl("https://ui-avatars.com/api/?name=" + sqlUser.getUsername() + "&background=random");
            profile.setVerificationStatus("NONE"); // Default status

            userProfileRepository.save(profile);
        } catch (Exception e) {
            System.err.println("❌ Failed to create MongoDB profile: " + e.getMessage());
        }
    }
}