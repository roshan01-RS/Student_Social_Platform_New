package com.conify.service;

import com.conify.model.mongo.Notification;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.NotificationRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * NotificationService handles the persistence and real-time delivery of 
 * user notifications across the Conify Platform.
 */
@Service
public class NotificationService {

    @Autowired private NotificationRepository notificationRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate; 

    /**
     * Creates a notification, saves it to MongoDB, and pushes it to the 
     * recipient's private WebSocket queue for real-time delivery.
     */
    public void createNotification(Long senderId, Long recipientId, Notification.NotificationType type, String message, String refId, String subRefId) {
        // Prevent users from receiving notifications for their own actions
        if (senderId.equals(recipientId)) return; 

        // Fetch sender details to create a snapshot for the UI
        UserProfile sender = userProfileRepository.findByUserId(senderId).orElse(null);
        String username = (sender != null) ? sender.getUsername() : "System";
        String avatar = (sender != null) ? sender.getAvatarUrl() : "";

        Notification notif = new Notification();
        notif.setSenderId(senderId);
        notif.setRecipientId(recipientId);
        notif.setType(type);
        notif.setMessage(message);
        notif.setReferenceId(refId);
        notif.setSubReferenceId(subRefId);
        notif.setSenderSnapshot(new Notification.SenderSnapshot(username, avatar));
        
        // Persist to Database
        Notification saved = notificationRepository.save(notif);

        // Pushes to the frontend in real-time via STOMP
        // Destination: /user/{recipientId}/queue/notifications
        messagingTemplate.convertAndSendToUser(
            String.valueOf(recipientId), 
            "/queue/notifications", 
            saved
        );
    }

    /**
     * Retrieves all notifications for a specific user, ordered by most recent.
     */
    public List<Notification> getUserNotifications(Long userId) {
        return notificationRepository.findByRecipientIdOrderByTimestampDesc(userId);
    }

    /**
     * Marks a single notification as read to prevent it from showing as new in the UI.
     */
    public void markAsRead(String notificationId) {
        notificationRepository.findById(notificationId).ifPresent(n -> {
            n.setRead(true);
            notificationRepository.save(n);
        });
    }

    /**
     * Marks all unread notifications as read for a specific user.
     */
    public void markAllAsRead(Long userId) {
        List<Notification> list = notificationRepository.findByRecipientIdAndIsReadFalseOrderByTimestampDesc(userId);
        list.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(list);
    }
}