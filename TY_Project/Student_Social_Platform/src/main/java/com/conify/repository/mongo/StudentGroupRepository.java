package com.conify.repository.mongo;

import com.conify.model.mongo.StudentGroup;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StudentGroupRepository extends MongoRepository<StudentGroup, String> {
    List<StudentGroup> findByMemberIdsContaining(Long userId);
    List<StudentGroup> findByNameContainingIgnoreCase(String name);
}