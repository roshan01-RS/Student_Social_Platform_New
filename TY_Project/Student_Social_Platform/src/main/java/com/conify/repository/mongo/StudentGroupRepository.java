package com.conify.repository.mongo;

import com.conify.model.mongo.StudentGroup;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StudentGroupRepository extends MongoRepository<StudentGroup, String> {
    
    // Find groups where user is Member OR has Left OR has Pending Request
    @Query("{ '$or': [ { 'memberIds': ?0 }, { 'leftMemberIds': ?0 }, { 'joinRequests': ?0 } ] }")
    List<StudentGroup> findUserGroups(Long userId);
}