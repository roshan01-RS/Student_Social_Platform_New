package com.conify.controller;

import com.conify.model.User;
import com.conify.model.mongo.UserProfile;
import com.conify.repository.mongo.UserProfileRepository;
import com.conify.repository.UserRepository;
import com.conify.service.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;


import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.File;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.HashMap;

@RestController
@RequestMapping("/api")
public class ProfileController {

    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private UserRepository userRepository;
    
    // CRITICAL FIX: Base directory derivation using File.separator for cross-OS compatibility
    private static final String BASE_DIR = System.getProperty("user.dir") 
        + File.separator + "src" + File.separator + "main" + File.separator + "resources" + File.separator + "static" + File.separator + "uploads" + File.separator;
    
    // Define full physical paths to the subfolders
    private static final String PROFILE_PHOTO_DIR = BASE_DIR + "profile_photos" + File.separator;
    // CRITICAL FIX: Explicit physical paths for documents
    private static final String DOCUMENT_ID_CARD_DIR = BASE_DIR + "documents" + File.separator + "idCards" + File.separator;
    private static final String DOCUMENT_RECEIPT_DIR = BASE_DIR + "documents" + File.separator + "receipts" + File.separator;

    private Long getCurrentUserId(String token) throws RuntimeException {
        if (!jwtUtil.validateToken(token)) throw new RuntimeException("Invalid Token");
        String username = jwtUtil.getUsernameFromToken(token);
        User user = userRepository.findByUsername(username).orElseThrow(() -> new RuntimeException("User not found"));
        return user.getId();
    }


    @GetMapping("/my-profile")
    public ResponseEntity<?> getMyProfile(@CookieValue(name = "authToken", required = false) String token) {
        if (token == null || !jwtUtil.validateToken(token)) {
             return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Invalid token or missing cookie"));
        }

        try {
            String username = jwtUtil.getUsernameFromToken(token);
            String searchName = username.startsWith("@") ? username : "@" + username;
            
            Optional<UserProfile> profileOpt = userProfileRepository.findByUsername(searchName);
            
            if (profileOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "User profile not found in MongoDB."));
            }
            
            UserProfile profile = profileOpt.get();
            Optional<User> userOpt = userRepository.findByUsername(username);
            
            Map<String, Object> responseData = new HashMap<>();
            
            // Copy all Mongo profile fields
            responseData.put("userId", profile.getUserId());
            responseData.put("username", profile.getUsername());
            responseData.put("email", profile.getEmail());
            responseData.put("schoolName", profile.getSchoolName());
            responseData.put("birthday", profile.getBirthday());
            responseData.put("joinedAt", profile.getJoinedAt());
            responseData.put("accountExpireDate", profile.getAccountExpireDate());
            responseData.put("avatarUrl", profile.getAvatarUrl());
            responseData.put("bio", profile.getBio());
            responseData.put("major", profile.getMajor());
            responseData.put("verificationStatus", profile.getVerificationStatus());
            responseData.put("idCardUrl", profile.getIdCardUrl());
            responseData.put("receiptUrl", profile.getReceiptUrl());
            
            // Add isVerified status from SQLite
            responseData.put("isVerified", userOpt.map(User::getIsVerified).orElse(0) == 1);
            
            return ResponseEntity.ok(responseData);

        } catch (Exception e) {
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
            if (updates.containsKey("avatarUrl")) profile.setAvatarUrl(updates.get("avatarUrl")); 
            
            userProfileRepository.save(profile);
            return ResponseEntity.ok(Map.of("message", "Profile updated"));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Update failed: " + e.getMessage()));
        }
    }

    @PostMapping("/my-profile/upload-photo")
    public ResponseEntity<?> uploadPhoto(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam("file") MultipartFile file) {

        if (token == null || !jwtUtil.validateToken(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            String webPath = saveImageFile(file, PROFILE_PHOTO_DIR, "uploads/profile_photos/");
            
            String username = jwtUtil.getUsernameFromToken(token);
            String searchName = username.startsWith("@") ? username : "@" + username;
            
            Optional<UserProfile> profileOpt = userProfileRepository.findByUsername(searchName);
            if (profileOpt.isPresent()) {
                UserProfile p = profileOpt.get();
                p.setAvatarUrl(webPath);
                userProfileRepository.save(p);
                return ResponseEntity.ok(Map.of("url", webPath, "message", "Photo uploaded successfully."));
            }

            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Profile not found for URL update."));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Upload failed: " + e.getMessage()));
        }
    }

    @PostMapping("/my-profile/upload-verification-docs")
    public ResponseEntity<?> uploadVerificationDocs(
            @CookieValue(name = "authToken", required = false) String token,
            @RequestParam("idCard") MultipartFile idCard,
            @RequestParam("receipt") MultipartFile receipt) {
        
        if (token == null || !jwtUtil.validateToken(token)) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();

        try {
            if (idCard.isEmpty() || receipt.isEmpty() || idCard.getSize() > 5 * 1024 * 1024 || receipt.getSize() > 5 * 1024 * 1024) {
                 return ResponseEntity.badRequest().body(Map.of("error", "Both documents are required and must be under 5MB."));
            }

            String username = jwtUtil.getUsernameFromToken(token);
            String searchName = username.startsWith("@") ? username : "@" + username;
            
            UserProfile profile = userProfileRepository.findByUsername(searchName)
                    .orElseThrow(() -> new RuntimeException("Profile not found."));

            // CRITICAL FIX: Use specific directories for storage
            String idCardPath = saveImageFile(idCard, DOCUMENT_ID_CARD_DIR, "uploads/documents/idCards/");
            String receiptPath = saveImageFile(receipt, DOCUMENT_RECEIPT_DIR, "uploads/documents/receipts/");

            profile.setIdCardUrl(idCardPath);
            profile.setReceiptUrl(receiptPath);
            profile.setVerificationStatus("PENDING");
            profile.setVerificationSubmittedAt(Instant.now());
            
            userProfileRepository.save(profile);
            
            return ResponseEntity.ok(Map.of(
                "status", "PENDING",
                "idCardUrl", idCardPath,
                "receiptUrl", receiptPath
            ));

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", "Verification upload failed: " + e.getMessage()));
        }
    }

    // Helper to save and compress images
    private String saveImageFile(MultipartFile file, String directory, String webPrefix) throws Exception {
        // Use directory (which now includes absolute path)
        File dir = new File(directory); 
        
        // Ensure the directory exists (CRITICAL FOR FILE EXCEPTION)
        if (!dir.exists()) {
            if (!dir.mkdirs()) {
                 // Log and throw a specific error if directory creation fails
                 System.err.println("Failed to create upload directory: " + directory);
                 throw new IllegalStateException("Could not create necessary upload directory.");
            }
        }

        String originalFilename = file.getOriginalFilename();
        String extension = ".jpg";
        if (originalFilename != null && originalFilename.contains(".")) {
            extension = originalFilename.substring(originalFilename.lastIndexOf("."));
        }
        
        String newFilename = UUID.randomUUID().toString() + extension;
        Path filePath = Paths.get(directory + newFilename);

        // Standard compression and write logic
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
        
        // Return web path (e.g., uploads/profile_photos/xyz.jpg)
        return webPrefix + newFilename;
    }
}