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

    // --- FIX: Added method for real-time username search ---
    List<UserProfile> findByUsernameStartingWithIgnoreCase(String usernamePrefix);
}