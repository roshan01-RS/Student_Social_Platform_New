package com.conify.repository;

import com.conify.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.sql.Timestamp;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByUsernameIgnoreCase(String username);

    // --- NEW METHOD ADDED ---
    // This allows the reset service to find the user by their OTP/token
    Optional<User> findByResetToken(String resetToken);

    void deleteByIsVerifiedAndOtpCreatedAtBefore(Integer isVerified, Timestamp expiryTime);
}