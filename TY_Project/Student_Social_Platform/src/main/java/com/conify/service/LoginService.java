package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.User;
import com.conify.model.mongo.UserProfile;
import com.conify.model.mongo.UserSession;
import com.conify.repository.UserRepository;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.mongo.UserSessionRepository;
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

    @Autowired private UserRepository userRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private UserSessionRepository userSessionRepository;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private EmailService emailService;

    /* =======================
       EXCEPTIONS
       ======================= */

    public static class InvalidCredentialsException extends Exception {
        public InvalidCredentialsException(String msg) { super(msg); }
    }

    public static class NotVerifiedException extends Exception {
        public NotVerifiedException(String msg) { super(msg); }
    }

    public static class BadRequestException extends Exception {
        public BadRequestException(String msg) { super(msg); }
    }

    /* =======================
       LOGIN
       ======================= */

    @Retryable(
        retryFor = CannotAcquireLockException.class,
        maxAttempts = 3,
        backoff = @Backoff(delay = 1000)
    )
    @Transactional
    public Map<String, String> loginUser(LoginDTO loginDTO, String ipAddress)
            throws InvalidCredentialsException, NotVerifiedException, BadRequestException {

        if (loginDTO == null) {
            throw new BadRequestException("Missing request body.");
        }

        String identifier = loginDTO.getIdentifier();
        String password = loginDTO.getPassword();

        if (identifier == null || identifier.trim().isEmpty()) {
            throw new BadRequestException("Username or email is required.");
        }

        if (password == null || password.isEmpty()) {
            throw new BadRequestException("Password is required.");
        }

        identifier = identifier.trim();

        Optional<User> userOpt = identifier.contains("@")
                ? userRepository.findByEmailIgnoreCase(identifier)
                : userRepository.findByUsernameIgnoreCase(identifier);

        if (userOpt.isEmpty()) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        User user = userOpt.get();

        BCrypt.Result result =
                BCrypt.verifyer().verify(password.toCharArray(), user.getPasswordHash());

        if (!result.verified) {
            throw new InvalidCredentialsException("Invalid username or password.");
        }

        if (user.getIsVerified() == 0) {
            throw new NotVerifiedException("Account not verified.");
        }

        syncUserProfileToMongo(user);
        recordLoginSession(user, ipAddress);

        LocalDateTime now = LocalDateTime.now();
        if (user.getLastLoginAt() == null) {
            sendWelcomeEmail(user, now);
        }

        user.setLastLoginAt(Timestamp.valueOf(now));
        userRepository.save(user);

        String token = jwtUtil.generateToken(user.getId(), user.getUsername());

        Map<String, String> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Login successful.");
        response.put("token", token);

        return response;
    }

    /* =======================
       LOGOUT (FIX FOR YOUR ERROR)
       ======================= */

    @Transactional
    public void logoutUser(Long userId) {
        if (userId == null) return;

        try {
            List<UserSession> activeSessions =
                    userSessionRepository.findByUserIdAndStatus(userId, "ACTIVE");

            for (UserSession session : activeSessions) {
                session.setLogoutTime(Instant.now());
                session.setStatus("CLOSED");
                userSessionRepository.save(session);
            }
        } catch (Exception e) {
            // Never crash logout
            e.printStackTrace();
        }
    }

    /* =======================
       HELPERS
       ======================= */

    private void syncUserProfileToMongo(User sqlUser) {
        try {
            UserProfile profile = userProfileRepository
                    .findByUserId(sqlUser.getId())
                    .orElseGet(() -> {
                        UserProfile p = new UserProfile(sqlUser.getId());
                        p.setJoinedAt(Instant.now());
                        p.setAvatarUrl(
                                "https://ui-avatars.com/api/?name=" +
                                sqlUser.getUsername() + "&background=random"
                        );
                        return p;
                    });

            profile.setUsername("@" + sqlUser.getUsername());
            profile.setEmail(sqlUser.getEmail());
            profile.setSchoolName(sqlUser.getSchoolName());
            profile.setBirthday(sqlUser.getBirthday());
            profile.setLastActive(Instant.now());

            if (sqlUser.getAccountExpireDate() != null) {
                profile.setAccountExpireDate(
                        sqlUser.getAccountExpireDate().toInstant()
                );
            }

            userProfileRepository.save(profile);
        } catch (Exception e) {
            System.err.println("⚠️ Mongo sync failed: " + e.getMessage());
        }
    }

    private void recordLoginSession(User user, String ipAddress) {
        try {
            userSessionRepository.save(
                    new UserSession(
                            user.getId(),
                            user.getUsername(),
                            ipAddress,
                            Instant.now()
                    )
            );
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void sendWelcomeEmail(User user, LocalDateTime time) {
        try {
            String formatted =
                    time.format(DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' hh:mm a"));

            String body =
                    "<p>Hi " + user.getUsername() + ",</p>" +
                    "<p>Welcome to Conify!</p>" +
                    "<p>First login: " + formatted + "</p>";

            emailService.sendEmail(user.getEmail(), "Welcome!", body);
        } catch (Exception ignored) {}
    }
}
