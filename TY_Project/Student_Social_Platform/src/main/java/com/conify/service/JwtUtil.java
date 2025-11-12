package com.conify.service; // Make sure this is your package name

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys; // <-- NEW IMPORT
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey; // <-- NEW IMPORT
import java.nio.charset.StandardCharsets; // <-- NEW IMPORT
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secretString;

    private SecretKey secretKey; // <-- NEW: Use a Key object

    // This method is called by Spring *after* the secretString is injected
    @jakarta.annotation.PostConstruct
    public void init() {
        // FIXED: This converts your 448-bit string into a 512-bit secure key
        this.secretKey = Keys.hmacShaKeyFor(secretString.getBytes(StandardCharsets.UTF_8));
    }

    private final long expirationTime = 86400000; // 24h in ms

    public String generateToken(Long userId, String username) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("userId", userId);
        
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(username)
                .setIssuedAt(new Date(System.currentTimeMillis()))
                .setExpiration(new Date(System.currentTimeMillis() + expirationTime))
                // FIXED: Use the modern, non-deprecated signWith(Key) method
                .signWith(secretKey, SignatureAlgorithm.HS512) 
                .compact();
    }
}