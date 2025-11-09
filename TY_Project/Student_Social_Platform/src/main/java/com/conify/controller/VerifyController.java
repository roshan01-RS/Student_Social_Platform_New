package com.conify.controller;

import com.conify.dto.VerifyDTO;
import com.conify.service.VerifyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class VerifyController {

    @Autowired
    private VerifyService verifyService;

    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verify(@RequestBody VerifyDTO verifyDTO) {
        Map<String, String> response = new HashMap<>();
        try {
            String successMessage = verifyService.verifyUser(verifyDTO);
            
            response.put("status", "success");
            response.put("message", successMessage);
            return ResponseEntity.ok(response);

        } catch (VerifyService.VerificationException e) {
            // Return 400 Bad Request for known verification failures (expired, wrong OTP)
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);

        } catch (Exception e) {
            // Return 500 for unexpected server crashes
            e.printStackTrace();
            response.put("status", "error");
            response.put("message", "Verification failed due to server error.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}