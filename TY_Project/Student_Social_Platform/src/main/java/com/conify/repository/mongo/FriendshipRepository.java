package com.conify.repository.mongo;

import com.conify.model.mongo.Friendship;
import com.conify.model.mongo.Friendship.FriendshipStatus;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FriendshipRepository extends MongoRepository<Friendship, String> {

    Optional<Friendship> findByRequesterIdAndRecipientId(Long requesterId, Long recipientId);

    List<Friendship> findByRecipientIdAndStatus(Long recipientId, FriendshipStatus status);

    List<Friendship> findByRequesterIdAndStatus(Long requesterId, FriendshipStatus status);

    // REQUIRED for friends + requests listing (NO findAll())
    List<Friendship> findByRequesterIdOrRecipientId(Long requesterId, Long recipientId);
}
