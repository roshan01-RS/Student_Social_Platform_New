package com.conify.service;

import com.conify.model.mongo.Friendship;
import com.conify.model.mongo.Friendship.FriendshipStatus;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.FriendshipRepository;
import com.conify.repository.mongo.NotificationRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class FriendshipService {

    @Autowired private FriendshipRepository friendshipRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationRepository notificationRepository;

    public List<UserProfile> searchUsers(String query) {
        // Find users whose username starts with the query (case-insensitive search is faster than LIKE)
        // MongoDB repository handles the pattern matching when using findByUsernameStartingWithIgnoreCase
        return userProfileRepository.findByUsernameStartingWithIgnoreCase("@" + query);
    }

    public FriendshipStatus getFriendshipStatus(Long currentUserId, Long targetUserId) {
        // Friendship should be checked bidirectionally
        // Try Requester -> Recipient
        Optional<Friendship> f1 = friendshipRepository.findByRequesterIdAndRecipientId(currentUserId, targetUserId);
        if (f1.isPresent()) return f1.get().getStatus();

        // Try Recipient -> Requester (if targetUserId sent the request)
        Optional<Friendship> f2 = friendshipRepository.findByRequesterIdAndRecipientId(targetUserId, currentUserId);
        if (f2.isPresent()) return f2.get().getStatus();

        return null; // No status, implicitly NOT_FRIENDS
    }

    public Friendship sendFriendRequest(Long requesterId, Long recipientId) throws Exception {
        if (requesterId.equals(recipientId)) {
            throw new IllegalArgumentException("Cannot send request to yourself.");
        }

        FriendshipStatus status = getFriendshipStatus(requesterId, recipientId);
        if (status != null) {
            throw new IllegalStateException("Friendship already exists with status: " + status);
        }

        // 1. Create PENDING Friendship
        Friendship request = new Friendship();
        request.setRequesterId(requesterId);
        request.setRecipientId(recipientId);
        request.setStatus(FriendshipStatus.PENDING);
        Friendship savedRequest = friendshipRepository.save(request);

        // 2. Create Notification
        UserProfile senderProfile = userProfileRepository.findByUserId(requesterId)
                .orElseThrow(() -> new RuntimeException("Sender profile not synced."));

        Notification notification = new Notification();
        notification.setRecipientId(recipientId);
        notification.setSenderId(requesterId);
        notification.setSenderSnapshot(new Notification.SenderSnapshot(
                senderProfile.getUsername(), senderProfile.getAvatarUrl()
        ));
        notification.setType(Notification.NotificationType.FRIEND_REQ);
        notification.setMessage("sent you a friend request");
        notificationRepository.save(notification);

        return savedRequest;
    }

    public void respondToRequest(Long currentUserId, Long requesterId, String action) throws Exception {
        // Check bidirectionally to find the PENDING request
        Optional<Friendship> friendshipOpt = friendshipRepository.findByRequesterIdAndRecipientId(requesterId, currentUserId);
        
        if (friendshipOpt.isEmpty()) {
            throw new IllegalArgumentException("Pending request not found.");
        }
        
        Friendship friendship = friendshipOpt.get();
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalStateException("Request status is already " + friendship.getStatus());
        }

        UserProfile recipientProfile = userProfileRepository.findByUserId(currentUserId).orElseThrow();
        Notification.NotificationType type;
        String message;

        if ("accept".equalsIgnoreCase(action)) {
            friendship.setStatus(FriendshipStatus.ACCEPTED);
            type = Notification.NotificationType.FRIEND_ACCEPT;
            message = "accepted your friend request";
        } else if ("reject".equalsIgnoreCase(action)) {
            friendship.setStatus(FriendshipStatus.REJECTED);
            type = Notification.NotificationType.FRIEND_REJECT;
            message = "rejected your friend request";
        } else {
            throw new IllegalArgumentException("Invalid action: must be 'accept' or 'reject'.");
        }
        
        friendshipRepository.save(friendship);

        // Notify the Requester about the response
        Notification responseNotif = new Notification();
        responseNotif.setRecipientId(requesterId);
        responseNotif.setSenderId(currentUserId);
        responseNotif.setSenderSnapshot(new Notification.SenderSnapshot(
                recipientProfile.getUsername(), recipientProfile.getAvatarUrl()
        ));
        responseNotif.setType(type);
        responseNotif.setMessage(message);
        notificationRepository.save(responseNotif);
    }
}