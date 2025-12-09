package com.conify.service;

import com.conify.model.mongo.UserProfile;
import com.conify.model.mongo.Notification;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.mongo.NotificationRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class AdminService {

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    /**
     * Fetches all user profiles where verification_status is 'PENDING'.
     * Maps the MongoDB document to a clean structure for the frontend.
     */
    public List<Map<String, Object>> getPendingVerifications() {
        // FIX: This now compiles because the method is defined in the repository
        List<UserProfile> pendingUsers = userProfileRepository.findByVerificationStatus("PENDING");

        return pendingUsers.stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId()); // The MongoDB ID used for updates
            map.put("name", u.getUsername() != null ? u.getUsername().replace("@", "") : "Unknown");
            
            // Handle missing fields gracefully
            map.put("rollNumber", "N/A"); 
            map.put("course", u.getMajor() != null ? u.getMajor() : "N/A");
            map.put("studentId", "UID-" + u.getUserId());
            
            map.put("submittedDate", u.getVerificationSubmittedAt() != null ? u.getVerificationSubmittedAt() : u.getJoinedAt());
            
            Map<String, String> docs = new HashMap<>();
            docs.put("idCard", u.getIdCardUrl());
            docs.put("feesReceipt", u.getReceiptUrl());
            map.put("documents", docs);
            
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * Updates the user's status to VERIFIED or REJECTED and sends a notification.
     */
    public void processVerification(String profileId, String status) throws Exception {
        UserProfile user = userProfileRepository.findById(profileId)
                .orElseThrow(() -> new Exception("User profile not found with ID: " + profileId));

        user.setVerificationStatus(status);
        userProfileRepository.save(user);

        // Notify the user about the decision
        sendVerificationNotification(user.getUserId(), status);
    }

    private void sendVerificationNotification(Long userId, String status) {
        Notification notification = new Notification();
        notification.setRecipientId(userId);
        notification.setSenderId(0L); // 0 denotes System/Admin
        notification.setSenderSnapshot(new Notification.SenderSnapshot("System", null));
        
        notification.setType(Notification.NotificationType.SYSTEM); 
        
        if ("VERIFIED".equals(status)) {
            notification.setMessage("Congratulations! Your documents have been verified.");
        } else {
            notification.setMessage("Your document verification was rejected. Please re-upload clear documents.");
        }
        
        notificationRepository.save(notification);
    }
}