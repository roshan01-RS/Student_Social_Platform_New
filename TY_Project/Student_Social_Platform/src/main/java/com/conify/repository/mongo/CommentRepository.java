package com.conify.repository.mongo;

import com.conify.model.mongo.Comment;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CommentRepository extends MongoRepository<Comment, String> {
    // Fetch top-level comments for a post
    List<Comment> findByPostIdAndParentCommentIdIsNullOrderByTimestampDesc(String postId);
    
    // Fetch replies for a specific comment
    List<Comment> findByParentCommentIdOrderByTimestampAsc(String parentCommentId);
    
    // Count comments for a post
    int countByPostId(String postId);
}