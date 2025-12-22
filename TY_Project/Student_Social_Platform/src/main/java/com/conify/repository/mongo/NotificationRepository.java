package com.conify.repository.mongo;

import com.conify.model.mongo.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import java.time.Instant;
import java.util.List;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String> {
    List<Notification> findByRecipientIdOrderByTimestampDesc(Long recipientId);
    
    // FETCH: Only notifications from a specific time (used for the 5-min filter)
    List<Notification> findByRecipientIdAndTimestampAfterOrderByTimestampDesc(Long recipientId, Instant time);

    List<Notification> findByRecipientIdAndIsReadFalseOrderByTimestampDesc(Long recipientId);

    // CLEANUP: Remove specific notifications when handled
    void deleteByRecipientIdAndSenderIdAndType(Long recipientId, Long senderId, Notification.NotificationType type);
}