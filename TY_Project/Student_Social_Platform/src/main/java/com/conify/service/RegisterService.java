package com.conify.service;

import com.conify.dto.RegisterDTO;
import com.conify.dto.CheckUserDTO;
import com.conify.model.User;
import com.conify.model.mongo.UserProfile; // Mongo
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.UserProfileRepository; // Mongo Repo
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
import java.time.Instant; // For Mongo
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

        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered. Please log in.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken. Please choose another.");
        }
    }

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public String registerUser(RegisterDTO registerDTO) throws Exception {
        
        String lowercaseEmail = registerDTO.getEmail().toLowerCase();
        String lowercaseUsername = registerDTO.getUsername().toLowerCase();

        // 1. Validation
        if (userRepository.existsByEmail(lowercaseEmail)) {
            throw new Exception("This email is already registered.");
        }
        if (userRepository.existsByUsername(lowercaseUsername)) {
            throw new Exception("This username is already taken.");
        }
        if (registerDTO.getBirthday() == null || registerDTO.getBirthday().isEmpty()) {
            throw new Exception("Birthday is required.");
        }
        LocalDate birthDate = LocalDate.parse(registerDTO.getBirthday());
        int age = Period.between(birthDate, LocalDate.now()).getYears();
        if (age < 11) {
            throw new Exception("You must be at least 11 years old to register.");
        }

        // 2. Hash & OTP
        String hashedPassword = BCrypt.withDefaults().hashToString(12, registerDTO.getPassword().toCharArray());
        String otp = String.format("%04d", new Random().nextInt(9000) + 1000);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiryDate = now.plusYears(1);

        // 3. Create SQLite Entity
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

        // 4. Save to SQLite (Generate ID)
        User savedUser = userRepository.save(newUser);

        // 5. SYNC TO MONGODB IMMEDIATELY
        createMongoProfile(savedUser);

        // 6. Send Email
        String emailSubject = "Your Conify Verification Code";
        // Fixed HTML Body
        String emailBody = "<p style=\"font-size: 18px; margin-bottom: 24px;\">Welcome to Conify!</p>"
                         + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">Your 4-digit verification code is:</p>"
                         + "<h2 style=\"font-size: 36px; color: white; letter-spacing: 4px; margin: 0 auto 24px auto; background-color: #374151; padding: 12px; border-radius: 12px; text-align: center; width: 150px;\">"
                         + otp
                         + "</h2>"
                         + "<p style=\"color: #9ca3af; font-size: 14px;\">This code will expire in 15 minutes.</p>";
        
        emailService.sendEmail(savedUser.getEmail(), emailSubject, emailBody);

        return "OTP sent to " + savedUser.getEmail();
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
            
            // FIX: Copy Expire Date
            if (sqlUser.getAccountExpireDate() != null) {
                profile.setAccountExpireDate(sqlUser.getAccountExpireDate().toInstant());
            }

            // Default avatar
            profile.setAvatarUrl("https://ui-avatars.com/api/?name=" + sqlUser.getUsername() + "&background=random");
            
            userProfileRepository.save(profile);
            System.out.println("✅ Created MongoDB Profile for: " + displayUsername);
        } catch (Exception e) {
            System.err.println("❌ Failed to create MongoDB profile: " + e.getMessage());
        }
    }
}
