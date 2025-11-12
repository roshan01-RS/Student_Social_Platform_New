package com.conify.repository;

import com.conify.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.Optional;
import java.sql.Timestamp;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    
    // --- Methods for other services ---
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);

    // --- FIXED: This is the ONLY method LoginService needs ---
    // It finds a user where the identifier matches EITHER the email OR the username,
    // ignoring case for both.
    @Query("SELECT u FROM User u WHERE LOWER(u.email) = LOWER(:identifier) OR LOWER(u.username) = LOWER(:identifier)")
    Optional<User> findByEmailOrUsernameIgnoreCase(@Param("identifier") String identifier);

    void deleteByIsVerifiedAndOtpCreatedAtBefore(Integer isVerified, Timestamp expiryTime);
}