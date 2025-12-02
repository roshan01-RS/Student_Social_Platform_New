package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.User;
import com.conify.model.mongo.UserProfile;
import com.conify.model.mongo.UserSession;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.mongo.UserSessionRepository;
import com.conify.service.JwtUtil;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.HashMap;
import java.util.Map;
import java.sql.Timestamp; 
import java.time.LocalDateTime; 
import java.time.format.DateTimeFormatter; 
import java.time.Instant;
import java.util.List;

import org.springframework.dao.CannotAcquireLockException;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LoginService {

    @Autowired
    private UserRepository userRepository;
    
    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private UserSessionRepository userSessionRepository;

    @Autowired
    private JwtUtil jwtUtil;
    
    @Autowired
    private EmailService emailService;

    public static class InvalidCredentialsException extends Exception {
        public InvalidCredentialsException(String message) { super(message); }
    }
    public static class NotVerifiedException extends Exception {
        public NotVerifiedException(String message) { super(message); }
    }

    @Retryable(retryFor = CannotAcquireLockException.class, maxAttempts = 3, backoff = @Backoff(delay = 1000))
    @Transactional
    public Map<String, String> loginUser(LoginDTO loginDTO, String ipAddress) throws InvalidCredentialsException, NotVerifiedException {
        
        String identifier = loginDTO.getIdentifier(); 
        String password = loginDTO.getPassword();

        Optional<User> userOpt;

        if (identifier.contains("@")) {
            userOpt = userRepository.findByEmailIgnoreCase(identifier);
        } else {
            userOpt = userRepository.findByUsernameIgnoreCase(identifier);
        }

        if (userOpt.isEmpty()) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        User user = userOpt.get();

        BCrypt.Result result = BCrypt.verifyer().verify(password.toCharArray(), user.getPasswordHash());
        if (!result.verified) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        if (user.getIsVerified() == 0) {
            throw new NotVerifiedException("Account not verified. Please check email for OTP.");
        }
        
        // --- 1. SYNC TO MONGODB ---
        syncUserProfileToMongo(user);
        
        // --- 2. LOG SESSION ---
        recordLoginSession(user, ipAddress);

        // --- 3. Update Login Time ---
        LocalDateTime loginTime = LocalDateTime.now();
        if (user.getLastLoginAt() == null) {
            sendWelcomeEmail(user, loginTime);
        }
        
        user.setLastLoginAt(Timestamp.valueOf(loginTime));
        userRepository.save(user);

        // --- 4. Generate Token ---
        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        Map<String, String> response = new HashMap<>();
        response.put("message", "Login successful.");
        response.put("token", token);
        
        return response;
    }

    private void syncUserProfileToMongo(User sqlUser) {
        try {
            Optional<UserProfile> mongoProfileOpt = userProfileRepository.findByUserId(sqlUser.getId());
            
            UserProfile profile;
            if (mongoProfileOpt.isPresent()) {
                profile = mongoProfileOpt.get();
            } else {
                profile = new UserProfile(sqlUser.getId());
                profile.setAvatarUrl("https://ui-avatars.com/api/?name=" + sqlUser.getUsername() + "&background=random");
                profile.setJoinedAt(Instant.now());
            }

            // Always ensure these are up to date
            String displayUsername = "@" + sqlUser.getUsername();
            profile.setUsername(displayUsername);
            profile.setEmail(sqlUser.getEmail());
            profile.setSchoolName(sqlUser.getSchoolName());
            profile.setBirthday(sqlUser.getBirthday());
            profile.setLastActive(Instant.now());
            
            if (sqlUser.getAccountExpireDate() != null) {
                 profile.setAccountExpireDate(sqlUser.getAccountExpireDate().toInstant());
            }
            
            userProfileRepository.save(profile);

        } catch (Exception e) {
            System.err.println("⚠️ Sync failed: " + e.getMessage());
        }
    }

    private void recordLoginSession(User user, String ipAddress) {
        try {
            UserSession session = new UserSession(
                user.getId(), 
                user.getUsername(), 
                ipAddress, 
                Instant.now()
            );
            userSessionRepository.save(session);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public void logoutUser(Long userId) {
        try {
            // FIX: This line needs to pass String "ACTIVE" to the repository, which is correct,
            // but the IDE/compiler needs the model to be clear that the status is a String.
            List<UserSession> activeSessions = userSessionRepository.findByUserIdAndStatus(userId, "ACTIVE");
            
            // FIX IS APPLIED HERE: The status is now set using a String literal.
            for (UserSession session : activeSessions) {
                session.setLogoutTime(Instant.now());
                session.setStatus("CLOSED"); 
                userSessionRepository.save(session);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void sendWelcomeEmail(User user, LocalDateTime loginTime) {
        try {
            String formattedTime = loginTime.format(DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a"));
            String body = "<p style=\"font-size: 18px; margin-bottom: 24px;\">Hi " + user.getUsername() + ",</p>"
                        + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">Welcome to Conify! We're thrilled to have you on board.</p>"
                        + "<p style=\"color: #e5e7eb; margin-bottom: 24px;\">You successfully logged in for the first time on: " + formattedTime + "</p>"
                        + "<p style=\"color: #e5e7eb;\">Enjoy connecting!<br/>- The Conify Team</p>";
            emailService.sendEmail(user.getEmail(), "Welcome!", body);
        } catch (Exception e) {
            // log error
        }
    }
}
