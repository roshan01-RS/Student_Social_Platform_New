package com.conify.controller;

import com.conify.dto.ResendDTO;
import com.conify.service.ResendService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ResendController {

    @Autowired
    private ResendService resendService;

    @PostMapping("/resend-otp")
    public ResponseEntity<?> resendOtp(@RequestBody ResendDTO dto) {
        try {
            // We don't actually need to return the OTP to the frontend for security reasons
            resendService.resendOtp(dto.getEmail());
            
            // Return standard success structure
            // You can use ResendDTO here if preferred, but a Map is flexible for status codes
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "OTP resent successfully.");
            return ResponseEntity.ok(response);

        } catch (ResendService.UserNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", "Failed to resend OTP."));
        }
    }
}