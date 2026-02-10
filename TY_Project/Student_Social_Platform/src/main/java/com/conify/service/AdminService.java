package com.conify.service;

import com.conify.dto.ProfileRealtimeEvent;
import com.conify.model.mongo.UserProfile;
import com.conify.model.mongo.Notification;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.mongo.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
public class AdminService {

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void processVerification(String profileId, String status) throws Exception {

        UserProfile user = userProfileRepository.findById(profileId)
                .orElseThrow(() -> new Exception("User profile not found"));

        status = status.toUpperCase();

        user.setVerificationStatus(status);

        if ("VERIFIED".equals(status)) {
            if (user.getAccountExpireDate() == null) {
                user.setAccountExpireDate(
                        Instant.now().plusSeconds(31536000) // +1 year
                );
            }
        } else {
            // 🔥 CRITICAL: Clear expiry on rejection
            user.setAccountExpireDate(null);
        }

        userProfileRepository.save(user);

        sendVerificationNotification(user.getUserId(), status);

        // 🔥 ALWAYS PUSH EVENT (NO IFs)
        ProfileRealtimeEvent evt = new ProfileRealtimeEvent(
                user.getVerificationStatus(),
                user.getAccountExpireDate()
        );

        messagingTemplate.convertAndSendToUser(
                user.getUserId().toString(),
                "/queue/profile",
                evt
        );
    }

    private void sendVerificationNotification(Long userId, String status) {

        Notification notification = new Notification();
        notification.setRecipientId(userId);
        notification.setSenderId(0L);
        notification.setSenderSnapshot(
                new Notification.SenderSnapshot("System", null)
        );
        notification.setType(Notification.NotificationType.SYSTEM);

        if ("VERIFIED".equals(status)) {
            notification.setMessage(
                    "Congratulations! Your documents have been verified."
            );
        } else if ("REJECTED".equals(status)) {
            notification.setMessage(
                    "Your document verification was rejected. Please re-upload clear documents."
            );
        }

        notificationRepository.save(notification);
    }
}
