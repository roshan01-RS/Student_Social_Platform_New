package com.conify.service;

import com.conify.model.mongo.Comment;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.Post;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.CommentRepository;
import com.conify.repository.mongo.CommunityMessageRepository;
import com.conify.repository.mongo.PostRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class CommentService {

    @Autowired private CommentRepository commentRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private CommunityMessageRepository communityMessageRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    /* =============================
       FETCH
    ============================= */

    public List<Comment> getCommentsForPost(String postId) {
        return commentRepository
                .findByPostIdAndParentCommentIdIsNullOrderByTimestampDesc(postId);
    }

    public List<Comment> getReplies(String commentId) {
        return commentRepository
                .findByParentCommentIdOrderByTimestampAsc(commentId);
    }

    /* =============================
       ADD COMMENT / REPLY
    ============================= */

    public Comment addComment(Long userId, String postId, String content, String parentCommentId) {

        UserProfile profile = userProfileRepository
                .findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User profile not found"));

        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setContent(content);
        comment.setParentCommentId(parentCommentId);
        comment.setAuthor(
                new Comment.AuthorSnapshot(
                        profile.getUsername(),
                        profile.getAvatarUrl()
                )
        );

        Comment saved = commentRepository.save(comment);

        /* =============================
           NORMAL POST
        ============================= */

        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isPresent()) {

            Post post = postOpt.get();

            // 🔥 AUTHORITATIVE COUNT (RACE SAFE)
            long rawCount = commentRepository.countByPostId(postId);
            int count = rawCount > Integer.MAX_VALUE
                    ? Integer.MAX_VALUE
                    : (int) rawCount;

            post.setCommentCount(count);
            postRepository.save(post);

            notificationService.createNotification(
                    userId,
                    post.getUserId(),
                    Notification.NotificationType.POST_COMMENT,
                    "commented on your post",
                    postId,
                    saved.getId()
            );

            // ---------- POST DETAILS ----------
            Map<String, Object> postPayload = new HashMap<>();
            postPayload.put("type", "COMMENT_ADDED");
            postPayload.put("postId", postId);
            postPayload.put("commentCount", count);
            postPayload.put("comment", saved);
            postPayload.put("parentCommentId", parentCommentId);

            messagingTemplate.convertAndSend(
                    "/topic/post/" + postId,
                    postPayload
            );

            // ---------- 🔥 HOME FEED ----------
            Map<String, Object> feedPayload = new HashMap<>();
            feedPayload.put("type", "COMMENT_ADDED");
            feedPayload.put("postId", postId);
            feedPayload.put("commentCount", count);

            messagingTemplate.convertAndSend(
                    "/topic/feed",
                    feedPayload
            );

            return saved;
        }

        /* =============================
           COMMUNITY POST
        ============================= */

        communityMessageRepository.findById(postId).ifPresent(msg -> {

            long rawCount = commentRepository.countByPostId(postId);
            int count = rawCount > Integer.MAX_VALUE
                    ? Integer.MAX_VALUE
                    : (int) rawCount;

            msg.setCommentCount(count);
            communityMessageRepository.save(msg);

            notificationService.createNotification(
                    userId,
                    msg.getSenderId(),
                    Notification.NotificationType.POST_COMMENT,
                    "replied to your community post",
                    postId,
                    saved.getId()
            );

            messagingTemplate.convertAndSend(
                    "/topic/community/" + msg.getCommunityId(),
                    Map.of(
                            "type", "POST_REPLIED",
                            "postId", postId,
                            "commentCount", count
                    )
            );

            Map<String, Object> postPayload = new HashMap<>();
            postPayload.put("type", "COMMENT_ADDED");
            postPayload.put("postId", postId);
            postPayload.put("commentCount", count);
            postPayload.put("comment", saved);
            postPayload.put("parentCommentId", parentCommentId);

            messagingTemplate.convertAndSend(
                    "/topic/post/" + postId,
                    postPayload
            );

            messagingTemplate.convertAndSend(
                    "/topic/feed",
                    Map.of(
                            "type", "COMMENT_ADDED",
                            "postId", postId,
                            "commentCount", count
                    )
            );
        });

        /* =============================
           THREAD REPLY NOTIFICATION
        ============================= */

        if (parentCommentId != null) {
            commentRepository.findById(parentCommentId).ifPresent(parent -> {
                notificationService.createNotification(
                        userId,
                        parent.getUserId(),
                        Notification.NotificationType.COMMENT_REPLY,
                        "replied to your comment",
                        postId,
                        saved.getId()
                );
            });
        }

        return saved;
    }
}
