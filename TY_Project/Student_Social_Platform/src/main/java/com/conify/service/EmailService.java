package com.conify.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service // 1. This tells Spring Boot to manage this class
public class EmailService {

    // 2. Spring Boot automatically provides this pre-configured sender
    @Autowired
    private JavaMailSender mailSender;

    public boolean sendEmail(String toEmail, String subject, String body) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            // You might want to set this to your actual sending email in application.properties
            // and read it here, but for now, this works if your SMTP server allows it.
            // message.setFrom("noreply@conify.com"); 
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(body);

            mailSender.send(message);
            
            System.out.println("✅ Email sent successfully to " + toEmail);
            return true;
        } catch (Exception e) {
            System.err.println("❌ Error sending email to " + toEmail + ": " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
}


