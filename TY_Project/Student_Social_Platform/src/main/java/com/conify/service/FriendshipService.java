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

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class FriendshipService {

    @Autowired private FriendshipRepository friendshipRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationRepository notificationRepository;

    public List<UserProfile> searchUsers(String query) {
        String cleanQuery = query.startsWith("@") ? query : "@" + query;
        return userProfileRepository.findByUsernameStartingWithIgnoreCase(cleanQuery);
    }

    public FriendshipStatus getFriendshipStatus(Long currentUserId, Long targetUserId) {
        Optional<Friendship> f1 = friendshipRepository.findByRequesterIdAndRecipientId(currentUserId, targetUserId);
        if (f1.isPresent()) return f1.get().getStatus();

        Optional<Friendship> f2 = friendshipRepository.findByRequesterIdAndRecipientId(targetUserId, currentUserId);
        if (f2.isPresent()) return f2.get().getStatus();

        return null; 
    }

    public Friendship sendFriendRequest(Long requesterId, Long recipientId) throws Exception {
        if (requesterId.equals(recipientId)) {
            throw new IllegalArgumentException("Cannot send request to yourself.");
        }

        FriendshipStatus status = getFriendshipStatus(requesterId, recipientId);
        
        if (status == FriendshipStatus.PENDING) {
             throw new IllegalStateException("Friend request already pending.");
        }
        if (status == FriendshipStatus.ACCEPTED) {
             throw new IllegalStateException("You are already friends.");
        }

        Friendship request = new Friendship();
        request.setRequesterId(requesterId);
        request.setRecipientId(recipientId);
        request.setStatus(FriendshipStatus.PENDING);
        Friendship savedRequest = friendshipRepository.save(request);

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
        Optional<Friendship> friendshipOpt = friendshipRepository.findByRequesterIdAndRecipientId(requesterId, currentUserId);
        
        if (friendshipOpt.isEmpty()) throw new IllegalArgumentException("Pending request not found.");
        
        Friendship friendship = friendshipOpt.get();
        if (friendship.getStatus() != FriendshipStatus.PENDING) {
            throw new IllegalStateException("Request is not pending.");
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
            throw new IllegalArgumentException("Invalid action.");
        }
        
        friendshipRepository.save(friendship);

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
    
    // --- UPDATED: Retrieve Accepted Friends AND Pending Requests ---
    public List<UserProfile> getFriendsAndRequests(Long userId) {
        // 1. Friends (Accepted) - Sent by user
        List<Friendship> sentAccepted = friendshipRepository.findByRequesterIdAndStatus(userId, FriendshipStatus.ACCEPTED);
        // 2. Friends (Accepted) - Received by user
        List<Friendship> receivedAccepted = friendshipRepository.findByRecipientIdAndStatus(userId, FriendshipStatus.ACCEPTED);
        // 3. Pending Requests - Sent by user (User wants to see pending outgoing requests)
        List<Friendship> sentPending = friendshipRepository.findByRequesterIdAndStatus(userId, FriendshipStatus.PENDING);
        // 4. Pending Requests - Received by user (Optional: Show incoming requests in list too?)
        List<Friendship> receivedPending = friendshipRepository.findByRecipientIdAndStatus(userId, FriendshipStatus.PENDING);
        
        List<Long> targetIds = new ArrayList<>();
        
        sentAccepted.forEach(f -> targetIds.add(f.getRecipientId()));
        receivedAccepted.forEach(f -> targetIds.add(f.getRequesterId()));
        sentPending.forEach(f -> targetIds.add(f.getRecipientId()));
        receivedPending.forEach(f -> targetIds.add(f.getRequesterId()));
        
        // Remove duplicates if any (though logic should prevent duplicate active friendships)
        List<Long> uniqueIds = targetIds.stream().distinct().collect(Collectors.toList());
        
        return userProfileRepository.findAllById(uniqueIds.stream().map(Object::toString).collect(Collectors.toList()));
    }

    // --- Remove Friendship / Cancel Request ---
    public void removeFriendship(Long currentUserId, Long targetUserId) {
        Optional<Friendship> f1 = friendshipRepository.findByRequesterIdAndRecipientId(currentUserId, targetUserId);
        if (f1.isPresent()) {
            friendshipRepository.delete(f1.get());
            return;
        }
        Optional<Friendship> f2 = friendshipRepository.findByRequesterIdAndRecipientId(targetUserId, currentUserId);
        if (f2.isPresent()) {
            friendshipRepository.delete(f2.get());
        }
    }
}