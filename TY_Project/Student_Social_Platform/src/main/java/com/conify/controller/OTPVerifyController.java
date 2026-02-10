package com.conify.controller;

import com.conify.dto.OTPVerifyDTO;
import com.conify.service.OTPVerifyService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class OTPVerifyController {

    @Autowired
    private OTPVerifyService otpVerifyService;

    @PostMapping("/verify")
    public ResponseEntity<Map<String, String>> verify(@RequestBody OTPVerifyDTO verifyDTO) {

        Map<String, String> response = new HashMap<>();

        try {
            String successMessage = otpVerifyService.verifyUser(verifyDTO);

            response.put("status", "success");
            response.put("message", successMessage);
            return ResponseEntity.ok(response);

        } catch (OTPVerifyService.OTPVerificationException e) {

            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);

        } catch (Exception e) {
            e.printStackTrace();

            response.put("status", "error");
            response.put("message", "Verification failed due to server error.");
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
}
