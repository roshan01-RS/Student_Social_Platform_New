package com.conify.service;

import com.conify.dto.LoginDTO;
import com.conify.model.mongo.Admin;
import com.conify.repository.mongo.AdminRepository;
import at.favre.lib.crypto.bcrypt.BCrypt;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.util.Optional;

@Service
public class AdminLoginService {

    @Autowired
    private AdminRepository adminRepository;

    @Autowired
    private JwtUtil jwtUtil; // Reuse existing JWT util for consistency

    // Create a default admin on startup if none exists
    @PostConstruct
    public void initDefaultAdmin() {
        if (adminRepository.count() == 0) {
            String defaultPass = BCrypt.withDefaults().hashToString(12, "admin123".toCharArray());
            Admin admin = new Admin("admin", defaultPass, "admin@conify.com");
            adminRepository.save(admin);
            System.out.println("⚠️ Default Admin Created: User='admin', Pass='admin123'");
        }
    }

    public String authenticateAdmin(LoginDTO loginDTO) throws Exception {
        Optional<Admin> adminOpt = adminRepository.findByUsername(loginDTO.getIdentifier());

        if (adminOpt.isEmpty()) {
            throw new Exception("Invalid admin username.");
        }

        Admin admin = adminOpt.get();
        BCrypt.Result result = BCrypt.verifyer().verify(loginDTO.getPassword().toCharArray(), admin.getPasswordHash());

        if (!result.verified) {
            throw new Exception("Invalid admin password.");
        }

        // Generate token with specific ADMIN role claim if needed, or just standard token
        // Using a fake ID (0) or string ID since Admin uses String ID in Mongo
        // Ideally update JwtUtil to handle String IDs or use a specific AdminJwtUtil
        // For simplicity, we assume JwtUtil accepts a Long, so we use 0L for admin
        return jwtUtil.generateToken(0L, admin.getUsername()); 
    }
}