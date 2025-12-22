package com.conify.service;

import com.conify.dto.FriendshipDTO;
import com.conify.model.mongo.Friendship;
import com.conify.model.mongo.Friendship.FriendshipStatus;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.FriendshipRepository;
import com.conify.repository.mongo.NotificationRepository;
import com.conify.repository.mongo.UserProfileRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FriendshipService {

    @Autowired private FriendshipRepository friendshipRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationRepository notificationRepository;

   // ---------------- SEARCH WITH FRIENDSHIP STATUS ----------------
public List<FriendshipDTO> searchUsersWithStatus(String query, Long currentUserId) {

    String clean = query.startsWith("@") ? query : "@" + query;

    List<UserProfile> users =
            userProfileRepository.findByUsernameStartingWithIgnoreCase(clean);

    List<FriendshipDTO> result = new ArrayList<>();

    for (UserProfile profile : users) {

        if (profile.getUserId().equals(currentUserId)) {
            continue; // skip self
        }

        FriendshipDTO dto = new FriendshipDTO();
        dto.setUserId(profile.getUserId());
        dto.setUsername(profile.getUsername());
        dto.setAvatarUrl(profile.getAvatarUrl());
        dto.setMajor(profile.getMajor());
        dto.setSchoolName(profile.getSchoolName());

        // default state
        dto.setStatus("NONE");
        dto.setDirection("NONE");

        // check outgoing
        friendshipRepository
                .findByRequesterIdAndRecipientId(currentUserId, profile.getUserId())
                .ifPresent(f -> {
                    dto.setStatus(f.getStatus().name());
                    if (f.getStatus() == FriendshipStatus.PENDING) {
                        dto.setDirection("OUTGOING");
                    } else if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                        dto.setDirection("FRIEND");
                    }
                });

        // check incoming
        friendshipRepository
                .findByRequesterIdAndRecipientId(profile.getUserId(), currentUserId)
                .ifPresent(f -> {
                    dto.setStatus(f.getStatus().name());
                    if (f.getStatus() == FriendshipStatus.PENDING) {
                        dto.setDirection("INCOMING");
                    } else if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                        dto.setDirection("FRIEND");
                    }
                });

        result.add(dto);
    }

    return result;
}


    // ---------------- SEND REQUEST ----------------
    public void sendFriendRequest(Long requesterId, Long recipientId) {

        if (requesterId.equals(recipientId)) {
            throw new IllegalArgumentException("Cannot add yourself");
        }

        friendshipRepository
                .findByRequesterIdAndRecipientId(requesterId, recipientId)
                .ifPresent(f -> {
                    if (f.getStatus() == FriendshipStatus.PENDING) {
                        throw new IllegalStateException("Request already pending");
                    }
                    if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                        throw new IllegalStateException("Already friends");
                    }
                    if (f.getStatus() == FriendshipStatus.REJECTED) {
                        throw new IllegalStateException("Request was rejected");
                    }
                });

        friendshipRepository
                .findByRequesterIdAndRecipientId(recipientId, requesterId)
                .ifPresent(f -> {
                    if (f.getStatus() == FriendshipStatus.PENDING) {
                        throw new IllegalStateException("User already sent you a request");
                    }
                });

        Friendship friendship = new Friendship();
        friendship.setRequesterId(requesterId);
        friendship.setRecipientId(recipientId);
        friendship.setStatus(FriendshipStatus.PENDING);
        friendshipRepository.save(friendship);

        UserProfile sender =
                userProfileRepository.findByUserId(requesterId).orElseThrow();

        Notification n = new Notification();
        n.setRecipientId(recipientId);
        n.setSenderId(requesterId);
        n.setType(Notification.NotificationType.FRIEND_REQ);
        n.setMessage("sent you a friend request");
        n.setSenderSnapshot(
                new Notification.SenderSnapshot(
                        sender.getUsername(),
                        sender.getAvatarUrl()
                )
        );

        notificationRepository.save(n);
    }

    // ---------------- RESPOND ----------------
    public void respond(Long currentUserId, Long requesterId, String action) {

        Friendship friendship =
                friendshipRepository
                        .findByRequesterIdAndRecipientId(requesterId, currentUserId)
                        .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalStateException("Request not pending");
        }

        if ("accept".equalsIgnoreCase(action)) {
            friendship.setStatus(FriendshipStatus.ACCEPTED);
        } else if ("reject".equalsIgnoreCase(action)) {
            friendship.setStatus(FriendshipStatus.REJECTED);
        } else {
            throw new IllegalArgumentException("Invalid action");
        }

        friendshipRepository.save(friendship);
    }

    // ---------------- REMOVE / CANCEL ----------------
    public void remove(Long currentUserId, Long targetUserId) {

        friendshipRepository
                .findByRequesterIdAndRecipientId(currentUserId, targetUserId)
                .ifPresent(friendshipRepository::delete);

        friendshipRepository
                .findByRequesterIdAndRecipientId(targetUserId, currentUserId)
                .ifPresent(friendshipRepository::delete);
    }

    // ---------------- LIST FRIENDS & REQUESTS ----------------
    public List<FriendshipDTO> getFriendsAndRequests(Long currentUserId) {

        List<Friendship> friendships =
                friendshipRepository.findByRequesterIdOrRecipientId(
                        currentUserId, currentUserId
                );

        List<FriendshipDTO> result = new ArrayList<>();

        for (Friendship f : friendships) {

            boolean isRequester = f.getRequesterId().equals(currentUserId);
            Long otherUserId = isRequester ? f.getRecipientId() : f.getRequesterId();

            UserProfile profile =
                    userProfileRepository.findByUserId(otherUserId).orElse(null);

            if (profile == null) continue;

            FriendshipDTO dto = new FriendshipDTO();
            dto.setUserId(profile.getUserId());
            dto.setUsername(profile.getUsername());
            dto.setAvatarUrl(profile.getAvatarUrl());
            dto.setMajor(profile.getMajor());
            dto.setSchoolName(profile.getSchoolName());
            dto.setStatus(f.getStatus().name());

            if (f.getStatus() == FriendshipStatus.ACCEPTED) {
                dto.setDirection("FRIEND");
            } else if (f.getStatus() == FriendshipStatus.PENDING) {
                dto.setDirection(isRequester ? "OUTGOING" : "INCOMING");
            }

            result.add(dto);
        }

        return result;
    }
}
