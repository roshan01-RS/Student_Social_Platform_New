package com.conify.repository.mongo;

import com.conify.model.mongo.UserProfile;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserProfileRepository extends MongoRepository<UserProfile, String> {
    Optional<UserProfile> findByUserId(Long userId);
    Optional<UserProfile> findByUsername(String username);
    
    // Needed for signup validation against existing profiles
    Optional<UserProfile> findByEmail(String email);

    List<UserProfile> findByUsernameStartingWithIgnoreCase(String usernamePrefix);
    
    // CRITICAL FIX: Add the missing query method used by AdminController and AdminService
    List<UserProfile> findByVerificationStatus(String status);
}