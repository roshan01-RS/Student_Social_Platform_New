package com.conify.repository.mongo;

import com.conify.model.mongo.CommunityMessage;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommunityMessageRepository extends MongoRepository<CommunityMessage, String> {
    List<CommunityMessage> findByCommunityIdOrderByTimestampDesc(String communityId);
}