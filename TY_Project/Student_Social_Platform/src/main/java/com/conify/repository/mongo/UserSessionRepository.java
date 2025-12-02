package com.conify.repository.mongo;

import com.conify.model.mongo.UserSession;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserSessionRepository extends MongoRepository<UserSession, String> {
    // FIX: Changed the expected status type from the old enum to String.
    List<UserSession> findByUserIdAndStatus(Long userId, String status);
}