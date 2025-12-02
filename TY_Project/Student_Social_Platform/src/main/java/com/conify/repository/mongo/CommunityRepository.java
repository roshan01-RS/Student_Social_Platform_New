package com.conify.repository.mongo;

import com.conify.model.mongo.Community;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommunityRepository extends MongoRepository<Community, String> {
    List<Community> findByMemberIdsContaining(Long userId);
    List<Community> findByNameContainingIgnoreCase(String name);
    List<Community> findByCategory(String category);
}