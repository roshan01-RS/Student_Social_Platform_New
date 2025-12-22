package com.conify.service;

import com.conify.model.mongo.Comment;
import com.conify.model.mongo.CommunityMessage;
import com.conify.model.mongo.Notification;
import com.conify.model.mongo.Post;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.CommentRepository;
import com.conify.repository.mongo.CommunityMessageRepository;
import com.conify.repository.mongo.PostRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class CommentService {

    @Autowired private CommentRepository commentRepository;
    @Autowired private PostRepository postRepository;
    @Autowired private CommunityMessageRepository communityMessageRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationService notificationService; // Integrated

    public Comment addComment(Long userId, String postId, String content, String parentCommentId) {
        UserProfile profile = userProfileRepository.findByUserId(userId).orElseThrow(() -> new RuntimeException("User profile not found"));

        Comment comment = new Comment();
        comment.setPostId(postId);
        comment.setUserId(userId);
        comment.setContent(content);
        comment.setParentCommentId(parentCommentId);
        comment.setAuthor(new Comment.AuthorSnapshot(profile.getUsername(), profile.getAvatarUrl()));

        Comment saved = commentRepository.save(comment);

        // Notify Post Author
        Optional<Post> postOpt = postRepository.findById(postId);
        if (postOpt.isPresent()) {
            Post post = postOpt.get();
            post.setCommentCount(post.getCommentCount() + 1);
            postRepository.save(post);

            notificationService.createNotification(
                userId, 
                post.getUserId(), 
                Notification.NotificationType.POST_COMMENT, 
                "commented on your post", 
                postId, 
                saved.getId()
            );
        } else {
            communityMessageRepository.findById(postId).ifPresent(msg -> {
                msg.setCommentCount(msg.getCommentCount() + 1);
                communityMessageRepository.save(msg);
                
                notificationService.createNotification(
                    userId, 
                    msg.getSenderId(), 
                    Notification.NotificationType.POST_COMMENT, 
                    "replied to your community post", 
                    postId, 
                    saved.getId()
                );
            });
        }

        // Notify Parent Comment Author (Threaded)
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

    public List<Comment> getCommentsForPost(String postId) {
        return commentRepository.findByPostIdAndParentCommentIdIsNullOrderByTimestampDesc(postId);
    }
    
    public List<Comment> getReplies(String commentId) {
        return commentRepository.findByParentCommentIdOrderByTimestampAsc(commentId);
    }
}