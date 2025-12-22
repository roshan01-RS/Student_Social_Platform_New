package com.conify.service;

import com.conify.model.mongo.Community;
import com.conify.repository.mongo.CommunityRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Service
public class CommunityService {

    @Autowired private CommunityRepository communityRepository;

    public Community createCommunity(String name, String description, String icon, Long ownerId) {
        Community community = new Community();
        community.setName(name);
        community.setDescription(description);
        community.setIcon(icon);
        community.setOwnerId(ownerId);
        community.getMemberIds().add(ownerId); 
        // Initialize map if needed, though constructor does it
        if (community.getMemberJoinDates() == null) {
            community.setMemberJoinDates(new java.util.HashMap<>());
        }
        community.getMemberJoinDates().put(String.valueOf(ownerId), Instant.now()); 
        return communityRepository.save(community);
    }

    public List<Community> getUserCommunities(Long userId) {
        return communityRepository.findByMemberIdsContaining(userId);
    }

    public List<Community> searchCommunities(String query) {
        if (query == null || query.isBlank()) {
            return communityRepository.findAll();
        }
        return communityRepository.findByNameContainingIgnoreCase(query);
    }

    public Community toggleMembership(String communityId, Long userId) {
        Optional<Community> commOpt = communityRepository.findById(communityId);
        if (commOpt.isPresent()) {
            Community comm = commOpt.get();
            if (comm.getMemberIds().contains(userId)) {
                comm.getMemberIds().remove(userId);
                comm.getMemberJoinDates().remove(String.valueOf(userId)); 
            } else {
                comm.getMemberIds().add(userId);
                comm.getMemberJoinDates().put(String.valueOf(userId), Instant.now()); 
            }
            return communityRepository.save(comm);
        }
        throw new RuntimeException("Community not found");
    }
}