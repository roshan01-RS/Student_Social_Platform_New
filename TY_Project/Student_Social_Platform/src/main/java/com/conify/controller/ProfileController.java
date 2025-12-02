package com.conify.controller;

import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.dao.DataAccessResourceFailureException; // Import for DB errors

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ProfileController {

    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserProfileRepository userProfileRepository;
    
    private static final String PROFILE_PHOTO_DIR = "src/main/resources/static/uploads/profile_photos/";

    @GetMapping("/my-profile")
    public ResponseEntity<?> getMyProfile(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null || !jwtUtil.validateToken(token)) {
             return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token or missing cookie"));
        }

        try {
            String username = jwtUtil.getUsernameFromToken(token);
            String searchName = username.startsWith("@") ? username : "@" + username;
            
            // Attempt to find the user profile in MongoDB
            Optional<UserProfile> profileOpt = userProfileRepository.findByUsername(searchName);

            if (profileOpt.isEmpty()) {
                // Scenario 1: User exists in SQLite but Mongo sync failed previously
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User profile not found in MongoDB. Please try logging in again to sync data."));
            }

            return ResponseEntity.ok(profileOpt.get());

        } catch (DataAccessResourceFailureException e) {
            // Scenario 2: Failed to connect to MongoDB
            System.err.println("CRITICAL: Failed to connect to MongoDB: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of("error", "Database connection failed. Please check MongoDB server status."));
        } catch (Exception e) {
            // General failure (e.g., JWT processing error)
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "An unexpected error occurred while fetching profile."));
        }
    }

    @PostMapping("/my-profile/update")
    public ResponseEntity<?> updateProfile(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestBody Map<String, String> updates) {
            
        if (token == null || !jwtUtil.validateToken(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        String username = jwtUtil.getUsernameFromToken(token);
        String searchName = username.startsWith("@") ? username : "@" + username;
        
        try {
            UserProfile profile = userProfileRepository.findByUsername(searchName)
                                .orElseThrow(() -> new RuntimeException("Profile not found or synced."));

            if (updates.containsKey("bio")) profile.setBio(updates.get("bio"));
            if (updates.containsKey("major")) profile.setMajor(updates.get("major"));
            
            userProfileRepository.save(profile);
            return ResponseEntity.ok(Map.of("message", "Profile updated"));
        } catch (RuntimeException e) {
             return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Update failed."));
        }
    }

    @PostMapping("/my-profile/upload-photo")
    public ResponseEntity<?> uploadPhoto(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam("file") MultipartFile file) {

        if (token == null || !jwtUtil.validateToken(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            File dir = new File(PROFILE_PHOTO_DIR);
            if (!dir.exists()) dir.mkdirs();

            String originalFilename = file.getOriginalFilename();
            String extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            String newFilename = UUID.randomUUID().toString() + extension;
            Path filePath = Paths.get(PROFILE_PHOTO_DIR + newFilename);

            // Compression Logic
            BufferedImage inputImage = ImageIO.read(file.getInputStream());
            int targetWidth = 500;
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

            // Update Mongo
            String username = jwtUtil.getUsernameFromToken(token);
            String searchName = username.startsWith("@") ? username : "@" + username;
            
            Optional<UserProfile> profileOpt = userProfileRepository.findByUsername(searchName);
            if (profileOpt.isPresent()) {
                UserProfile p = profileOpt.get();
                String webPath = "uploads/profile_photos/" + newFilename;
                p.setAvatarUrl(webPath);
                userProfileRepository.save(p);
                return ResponseEntity.ok(Map.of("url", webPath));
            }

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Profile not found for URL update."));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }
}