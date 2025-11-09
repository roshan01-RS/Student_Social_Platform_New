package com.conify.repository;

import com.conify.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.sql.Timestamp;
import java.time.LocalDateTime;


@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    // Spring automatically implements this to check for duplicates.
    // Replaces: "SELECT 1 FROM users WHERE email = ?"
    boolean existsByEmail(String email);

    boolean existsByUsername(String username);
    
    // Spring automatically implements this to find a user.
    // Replaces: "SELECT * FROM users WHERE email = ?"
    Optional<User> findByEmail(String email);

    // --- NEW: Magic method to delete expired, unverified users ---
    // Spring automatically translates this long name into the correct SQL DELETE query.
    void deleteByIsVerifiedAndOtpCreatedAtBefore(Integer isVerified, Timestamp expiryTime);
}