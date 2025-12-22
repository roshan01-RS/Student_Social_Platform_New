package com.conify.service;

import com.conify.model.mongo.Notification;
import com.conify.model.mongo.Post;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.PostRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class PostService {

    @Autowired private PostRepository postRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private NotificationService notificationService; // Added Integration

    private static final String CONTENT_UPLOAD_DIR = "src/main/resources/static/uploads/content/";
    
    public String saveAndCompressImage(MultipartFile file) throws Exception {
        File dir = new File(CONTENT_UPLOAD_DIR);
        if (!dir.exists()) {
             if (!dir.mkdirs()) throw new IllegalStateException("Failed to create upload directory");
        }
        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String newFilename = UUID.randomUUID().toString() + extension;
        Path filePath = Paths.get(dir.getAbsolutePath(), newFilename);

        BufferedImage inputImage = ImageIO.read(file.getInputStream());
        int targetWidth = 800; 
        if (inputImage.getWidth() > targetWidth) {
            int targetHeight = (int) (inputImage.getHeight() * ((double) targetWidth / inputImage.getWidth()));
            BufferedImage outputImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = outputImage.createGraphics();
            g2d.drawImage(inputImage, 0, 0, targetWidth, targetHeight, null);
            g2d.dispose();
            ImageIO.write(outputImage, extension.substring(1), filePath.toFile());
        } else {
            file.transferTo(filePath.toFile());
        }
        return "uploads/content/" + newFilename;
    }

    public Post createPost(Long userId, String content, MultipartFile imageFile) throws Exception {
        return createPost(userId, content, imageFile, null);
    }

    public Post createPost(Long userId, String content, MultipartFile imageFile, String communityId) throws Exception {
        UserProfile profile = userProfileRepository.findByUserId(userId).orElseThrow(() -> new Exception("Profile sync error"));
        Post post = new Post();
        post.setUserId(userId);
        post.setContent(content);
        post.setCommunityId(communityId);
        post.setCreatedAt(Instant.now());
        post.setAuthorSnapshot(new Post.AuthorSnapshot(profile.getUsername(), profile.getAvatarUrl(), profile.getMajor()));
        if (imageFile != null && !imageFile.isEmpty()) {
            post.setMediaUrl(saveAndCompressImage(imageFile)); 
            post.setMediaType(Post.MediaType.IMAGE);
        } else {
            post.setMediaType(Post.MediaType.NONE);
        }
        return postRepository.save(post);
    }

    public List<Post> getFeed() {
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    public Post toggleLike(String postId, Long userId) throws Exception {
        Post post = postRepository.findById(postId).orElseThrow(() -> new Exception("Post not found"));
        List<Long> likes = post.getLikes();
        if (likes.contains(userId)) {
            likes.remove(userId);
        } else {
            likes.add(userId);
            // TRIGGER NOTIFICATION
            notificationService.createNotification(
                userId, post.getUserId(), Notification.NotificationType.POST_LIKE, 
                "liked your post", post.getId(), null
            );
        }
        post.setLikes(likes);
        post.setLikeCount(likes.size());
        return postRepository.save(post);
    }
}