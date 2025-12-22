package com.conify.repository.mongo;

import com.conify.model.mongo.Post;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PostRepository extends MongoRepository<Post, String> {
    List<Post> findAllByOrderByCreatedAtDesc();
    
    // ADDED: Support for community-specific feeds
    List<Post> findByCommunityIdOrderByCreatedAtDesc(String communityId);
}