package com.conify.repository.mongo;

import com.conify.model.mongo.Community;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommunityRepository extends MongoRepository<Community, String> {
    // Find communities containing a specific member
    List<Community> findByMemberIdsContaining(Long userId);
    
    // Search communities by name (case insensitive matching usually done via regex in service or custom query)
    List<Community> findByNameContainingIgnoreCase(String name);
}