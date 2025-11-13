package com.conify.service; // Make sure this package name is correct

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import io.jsonwebtoken.Claims; // <-- FIXED: Added missing import
import io.jsonwebtoken.Jws; // <-- FIXED: Added missing import
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtUtil {

    @Value("${jwt.secret}")
    private String secretString;

    private SecretKey secretKey;

    @jakarta.annotation.PostConstruct
    public void init() {
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
                .signWith(secretKey, SignatureAlgorithm.HS512) 
                .compact();
    }

    // --- NEW METHOD 1: Get Claims (the data inside) from Token ---
    private Jws<Claims> getClaims(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(secretKey)
                .build()
                .parseClaimsJws(token);
    }

    // --- NEW METHOD 2: Validate the token ---
    public boolean validateToken(String token) {
        try {
            getClaims(token);
            return true;
        } catch (Exception e) {
            // Catches expired, malformed, etc.
            return false;
        }
    }

    // --- NEW METHOD 3: Get Username from Token ---
    public String getUsernameFromToken(String token) {
        return getClaims(token).getBody().getSubject();
    }
}