package com.conify.repository.mongo;

import com.conify.model.mongo.Conversation;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, String> {
    // Used by ChatController to fetch all conversations involving a user
    List<Conversation> findByParticipantsContaining(Long userId);
}