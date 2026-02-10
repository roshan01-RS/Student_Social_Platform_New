package com.conify.service;

import com.conify.model.mongo.Notification;
import com.conify.model.mongo.Post;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.PostRepository;
import com.conify.repository.mongo.UserProfileRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
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
    @Autowired private NotificationService notificationService;
    @Autowired private SimpMessagingTemplate messagingTemplate;

    private static final String CONTENT_UPLOAD_DIR = "src/main/resources/static/uploads/content/";

    /* =====================================================
       🔥 REQUIRED BY ChatController + PostController
       ===================================================== */
    public String saveAndCompressImage(MultipartFile file) throws Exception {
        File dir = new File(CONTENT_UPLOAD_DIR);
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Failed to create upload directory");
        }

        String original = file.getOriginalFilename();
        if (original == null || !original.contains(".")) {
            throw new IllegalArgumentException("Invalid file name");
        }

        String ext = original.substring(original.lastIndexOf("."));
        String name = UUID.randomUUID() + ext;
        Path path = Paths.get(dir.getAbsolutePath(), name);

        BufferedImage input = ImageIO.read(file.getInputStream());
        if (input == null) throw new IllegalArgumentException("Invalid image");

        int targetWidth = 900;
        if (input.getWidth() > targetWidth) {
            int targetHeight = (int) (input.getHeight() * ((double) targetWidth / input.getWidth()));
            BufferedImage output = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = output.createGraphics();
            g.drawImage(input, 0, 0, targetWidth, targetHeight, null);
            g.dispose();
            ImageIO.write(output, ext.substring(1), path.toFile());
        } else {
            file.transferTo(path.toFile());
        }

        return "uploads/content/" + name;
    }

    /* =====================================================
       POST CREATION (FEED + REALTIME)
       ===================================================== */
    public Post createPost(Long userId, String content, MultipartFile imageFile) throws Exception {

        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new RuntimeException("User profile not found"));

        Post post = new Post();
        post.setUserId(userId);
        post.setContent(content);
        post.setCreatedAt(Instant.now());
        post.setAuthorSnapshot(
                new Post.AuthorSnapshot(
                        profile.getUsername(),
                        profile.getAvatarUrl(),
                        profile.getMajor()
                )
        );

        if (imageFile != null && !imageFile.isEmpty()) {
            post.setMediaUrl(saveAndCompressImage(imageFile));
            post.setMediaType(Post.MediaType.IMAGE);
        } else {
            post.setMediaType(Post.MediaType.NONE);
        }

        Post saved = postRepository.save(post);

        // 🔥 REALTIME FEED PUSH
        messagingTemplate.convertAndSend(
                "/topic/feed",
                java.util.Map.of("type", "POST_CREATED", "post", saved)
        );

        return saved;
    }

    /* =====================================================
       FEED
       ===================================================== */
    public List<Post> getFeed() {
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    /* =====================================================
       LIKE TOGGLE (RACE SAFE)
       ===================================================== */
    public Post toggleLike(String postId, Long userId) throws Exception {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new RuntimeException("Post not found"));

        synchronized (post) {
            if (post.getLikes().contains(userId)) {
                post.getLikes().remove(userId);
            } else {
                post.getLikes().add(userId);
                notificationService.createNotification(
                        userId,
                        post.getUserId(),
                        Notification.NotificationType.POST_LIKE,
                        "liked your post",
                        post.getId(),
                        null
                );
            }
            post.setLikeCount(post.getLikes().size());
        }

        Post saved = postRepository.save(post);

        // 🔥 REALTIME UPDATE
        messagingTemplate.convertAndSend(
                "/topic/feed",
                java.util.Map.of("type", "POST_LIKED", "post", saved)
        );

        return saved;
    }
}
