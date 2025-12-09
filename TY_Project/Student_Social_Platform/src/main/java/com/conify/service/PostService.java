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

    @Autowired private PostRepository postRepository;
    @Autowired private UserProfileRepository userProfileRepository;

    private static final String CONTENT_UPLOAD_DIR = "src/main/resources/static/uploads/content/";
    
    // --- PUBLIC Helper: Image Compression Logic ---
    public String saveAndCompressImage(MultipartFile file) throws Exception {
        // Ensure directory exists based on project root
        File dir = new File(CONTENT_UPLOAD_DIR);
        if (!dir.exists()) {
             // Attempt to create directories if they don't exist
             if (!dir.mkdirs()) {
                 throw new IllegalStateException("Failed to create upload directory: " + CONTENT_UPLOAD_DIR);
             }
        }

        String originalFilename = file.getOriginalFilename();
        String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        String newFilename = UUID.randomUUID().toString() + extension;
        
        // Use the absolute path for file transfer
        Path filePath = Paths.get(dir.getAbsolutePath(), newFilename);

        // Compression Logic
        BufferedImage inputImage = ImageIO.read(file.getInputStream());
        int targetWidth = 800; 
        
        if (inputImage.getWidth() > targetWidth) {
            int targetHeight = (int) (inputImage.getHeight() * ((double) targetWidth / inputImage.getWidth()));
            BufferedImage outputImage = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g2d = outputImage.createGraphics();
            g2d.drawImage(inputImage, 0, 0, targetWidth, targetHeight, null);
            g2d.dispose();
            
            // Write compressed image to disk
            ImageIO.write(outputImage, extension.substring(1), filePath.toFile());
        } else {
            // Write original file to disk
            file.transferTo(filePath.toFile());
        }

        // Return relative path (Web Path) that the Resource Handler maps
        return "uploads/content/" + newFilename;
    }
    // --- End Helper ---

    public Post createPost(Long userId, String content, MultipartFile imageFile) throws Exception {
        UserProfile profile = userProfileRepository.findByUserId(userId)
                .orElseThrow(() -> new Exception("Profile sync error"));

        Post post = new Post();
        post.setUserId(userId);
        post.setContent(content);
        post.setCreatedAt(Instant.now());
        
        post.setAuthorSnapshot(new Post.AuthorSnapshot(
                profile.getUsername(), 
                profile.getAvatarUrl(), 
                profile.getMajor()
        ));

        if (imageFile != null && !imageFile.isEmpty()) {
            String mediaUrl = saveAndCompressImage(imageFile); 
            post.setMediaType(Post.MediaType.IMAGE);
            post.setMediaUrl(mediaUrl); 
        } else {
            post.setMediaType(Post.MediaType.NONE);
        }

        return postRepository.save(post);
    }

    public List<Post> getFeed() {
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
}