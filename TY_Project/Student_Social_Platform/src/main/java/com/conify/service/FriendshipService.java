package com.conify.service;

import com.conify.dto.FriendshipDTO;
import com.conify.dto.FriendshipEvent;
import com.conify.model.mongo.Friendship;
import com.conify.model.mongo.Friendship.FriendshipStatus;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.FriendshipRepository;
import com.conify.repository.mongo.UserProfileRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class FriendshipService {

    @Autowired private FriendshipRepository friendshipRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    /* ============================================================
       REAL-TIME EVENT PUSH
       ============================================================ */

    private void pushEvent(Long toUserId, FriendshipEvent event) {
        messagingTemplate.convertAndSendToUser(
                String.valueOf(toUserId),
                "/queue/friendship",
                event
        );
    }

    /* ============================================================
       SEARCH USERS WITH STATUS  ✅ (THIS WAS MISSING)
       ============================================================ */

    public List<FriendshipDTO> searchUsersWithStatus(String query, Long currentUserId) {

        String clean = query.startsWith("@") ? query : "@" + query;

        List<UserProfile> users =
                userProfileRepository.findByUsernameStartingWithIgnoreCase(clean);

        List<FriendshipDTO> result = new ArrayList<>();

        for (UserProfile profile : users) {

            if (profile.getUserId().equals(currentUserId)) continue;

            FriendshipDTO dto = new FriendshipDTO();
            dto.setUserId(profile.getUserId());
            dto.setUsername(profile.getUsername());
            dto.setAvatarUrl(profile.getAvatarUrl());
            dto.setMajor(profile.getMajor());
            dto.setSchoolName(profile.getSchoolName());

            dto.setStatus("NONE");
            dto.setDirection("NONE");

            friendshipRepository
                    .findByRequesterIdAndRecipientId(currentUserId, profile.getUserId())
                    .ifPresent(f -> {
                        dto.setStatus(f.getStatus().name());
                        dto.setDirection(
                                f.getStatus() == FriendshipStatus.PENDING
                                        ? "OUTGOING"
                                        : "FRIEND"
                        );
                    });

            friendshipRepository
                    .findByRequesterIdAndRecipientId(profile.getUserId(), currentUserId)
                    .ifPresent(f -> {
                        dto.setStatus(f.getStatus().name());
                        dto.setDirection(
                                f.getStatus() == FriendshipStatus.PENDING
                                        ? "INCOMING"
                                        : "FRIEND"
                        );
                    });

            result.add(dto);
        }

        return result;
    }

    /* ============================================================
       SEND FRIEND REQUEST
       ============================================================ */

    public void sendFriendRequest(Long requesterId, Long recipientId) {

        Friendship friendship = new Friendship();
        friendship.setRequesterId(requesterId);
        friendship.setRecipientId(recipientId);
        friendship.setStatus(FriendshipStatus.PENDING);
        friendshipRepository.save(friendship);

        pushEvent(recipientId,
                new FriendshipEvent(requesterId, recipientId, "PENDING", "INCOMING"));
        pushEvent(requesterId,
                new FriendshipEvent(recipientId, requesterId, "PENDING", "OUTGOING"));
    }

    /* ============================================================
       RESPOND (ACCEPT / REJECT)
       ============================================================ */

    public void respond(Long currentUserId, Long requesterId, String action) {

        Friendship friendship =
                friendshipRepository
                        .findByRequesterIdAndRecipientId(requesterId, currentUserId)
                        .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        if ("accept".equalsIgnoreCase(action)) {
            friendship.setStatus(FriendshipStatus.ACCEPTED);
            friendshipRepository.save(friendship);

            pushEvent(requesterId,
                    new FriendshipEvent(currentUserId, requesterId, "ACCEPTED", "FRIEND"));
            pushEvent(currentUserId,
                    new FriendshipEvent(requesterId, currentUserId, "ACCEPTED", "FRIEND"));

        } else {
            friendshipRepository.delete(friendship);

            pushEvent(requesterId,
                    new FriendshipEvent(currentUserId, requesterId, "NONE", "NONE"));
            pushEvent(currentUserId,
                    new FriendshipEvent(requesterId, currentUserId, "NONE", "NONE"));
        }
    }

    /* ============================================================
       REMOVE / CANCEL
       ============================================================ */

    public void remove(Long currentUserId, Long targetUserId) {

        friendshipRepository
                .findByRequesterIdAndRecipientId(currentUserId, targetUserId)
                .ifPresent(friendshipRepository::delete);

        friendshipRepository
                .findByRequesterIdAndRecipientId(targetUserId, currentUserId)
                .ifPresent(friendshipRepository::delete);

        pushEvent(currentUserId,
                new FriendshipEvent(targetUserId, currentUserId, "NONE", "NONE"));
        pushEvent(targetUserId,
                new FriendshipEvent(currentUserId, targetUserId, "NONE", "NONE"));
    }

    /* ============================================================
       LIST FRIENDS & REQUESTS
       ============================================================ */

    public List<FriendshipDTO> getFriendsAndRequests(Long currentUserId) {

        List<Friendship> friendships =
                friendshipRepository.findByRequesterIdOrRecipientId(
                        currentUserId, currentUserId);

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
            dto.setDirection(
                    f.getStatus() == FriendshipStatus.ACCEPTED
                            ? "FRIEND"
                            : (isRequester ? "OUTGOING" : "INCOMING")
            );

            result.add(dto);
        }
        return result;
    }
}
