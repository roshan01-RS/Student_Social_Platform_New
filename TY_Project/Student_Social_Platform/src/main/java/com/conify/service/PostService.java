package com.conify.service;

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

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    // Directory for post content images
    private static final String CONTENT_UPLOAD_DIR = "src/main/resources/static/uploads/content/";

    public Post createPost(Long userId, String content, MultipartFile imageFile) throws Exception {
        // 1. Fetch User Profile for Snapshot
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new Exception("User profile not found. Please relogin to sync."));

        // 2. Create Post Object
        Post post = new Post();
        post.setUserId(userId);
        post.setContent(content);
        post.setCreatedAt(Instant.now());

        // 3. Create Author Snapshot (Denormalization)
        Post.AuthorSnapshot snapshot = new Post.AuthorSnapshot(
                profile.getUsername(),
                profile.getAvatarUrl(),
                profile.getMajor()
        );
        post.setAuthorSnapshot(snapshot);

        // 4. Handle Image Upload (if present)
        if (imageFile != null && !imageFile.isEmpty()) {
            String mediaUrl = saveAndCompressImage(imageFile);
            post.setMediaUrl(mediaUrl);
            post.setMediaType(Post.MediaType.IMAGE);
        } else {
            post.setMediaType(Post.MediaType.NONE);
        }

        // 5. Save to MongoDB
        return postRepository.save(post);
    }

    public List<Post> getFeed() {
        // Fetch all posts, sorted by newest first
        return postRepository.findAllByOrderByCreatedAtDesc();
    }

    public Post toggleLike(String postId, Long userId) throws Exception {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new Exception("Post not found"));

        List<Long> likes = post.getLikes();
        if (likes.contains(userId)) {
            likes.remove(userId); // Unlike
        } else {
            likes.add(userId); // Like
        }
        post.setLikes(likes);
        post.setLikeCount(likes.size());
        
        return postRepository.save(post);
    }

    // --- Helper: Image Compression Logic ---
    private String saveAndCompressImage(MultipartFile file) throws Exception {
        File dir = new File(CONTENT_UPLOAD_DIR);
        if (!dir.exists()) dir.mkdirs();

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String newFilename = UUID.randomUUID().toString() + extension;
        Path filePath = Paths.get(CONTENT_UPLOAD_DIR + newFilename);

        // Compress/Resize
        BufferedImage inputImage = ImageIO.read(file.getInputStream());
        int targetWidth = 800; // Larger width for posts
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

        // Return relative path for frontend
        return "uploads/content/" + newFilename;
    }
}