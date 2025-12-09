package com.conify.repository.mongo;

import com.conify.model.mongo.Friendship;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends MongoRepository<Friendship, String> {
    Optional<Friendship> findByRequesterIdAndRecipientId(Long r1, Long r2);
    List<Friendship> findByRecipientIdAndStatus(Long recipientId, Friendship.FriendshipStatus status); 
    
    // CRITICAL FIX: Added method to find requests SENT by user with specific status
    List<Friendship> findByRequesterIdAndStatus(Long requesterId, Friendship.FriendshipStatus status);
}