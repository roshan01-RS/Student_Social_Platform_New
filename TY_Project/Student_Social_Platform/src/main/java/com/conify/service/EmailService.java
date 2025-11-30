package com.conify.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public boolean sendEmail(String toEmail, String subject, String messageBody) {
        try {
            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, true, "UTF-8");
            
            String htmlContent = buildEmailTemplate(subject, messageBody);
            
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true); // true = this is HTML
            // helper.setFrom("noreply@conify.com"); 

            mailSender.send(mimeMessage);
            
            System.out.println("✅ HTML Email sent successfully to " + toEmail);
            return true;
        } catch (Exception e) {
            System.err.println("❌ Error sending HTML email to " + toEmail + ": " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }

    private String buildEmailTemplate(String subject, String messageBody) {
        
        // --- THIS IS THE CRITICAL FIX ---
        // I have replaced the modern CSS (display: flex) with a
        // bulletproof, old-school <table> to force centering in all email clients.
        String logoHtml =
            // 1. Outer div for background, rounded corners, and size.
            "<div style=\"width: 72px; height: 72px; background: linear-gradient(135deg, #00f0ff, #ff006e); border-radius: 20px; margin: 0 auto;\">"
            // 2. Use a table for bulletproof centering.
            + "<table width=\"100%\" height=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\">"
            +   "<tr>"
            +     "<td align=\"center\" valign=\"middle\" style=\"font-family: Arial, sans-serif; font-size: 40px; font-weight: 800; color: #FFFFFF; line-height: 1;\">"
            +       "C" // The text letter
            +     "</td>"
            +   "</tr>"
            + "</table>"
            + "</div>"
            + "<h1 style=\"color: #ffffff; font-size: 28px; font-weight: 600; text-align: center; margin-top: 16px;\">Conify</h1>";
        // --- END OF FIX ---

        return "<!DOCTYPE html>"
            + "<html lang=\"en\">"
            + "<head><meta charset=\"UTF-8\"><title>" + subject + "</title></head>"
            + "<body style=\"margin: 0; padding: 0; font-family: 'Inter', Arial, sans-serif; background-color: #111827;\">"
            + "  <table width=\"100%\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\">"
            + "    <tr><td align=\"center\" style=\"padding: 40px 20px;\">"
            + "      <table width=\"600\" border=\"0\" cellspacing=\"0\" cellpadding=\"0\" style=\"max-width: 600px; width: 100%; background-color: #1f2937; border-radius: 24px; border: 1px solid #374151;\">"
            + "        <!-- Logo Section -->"
            + "        <tr><td align=\"center\" style=\"padding: 40px 20px 20px 20px;\">"
            +            logoHtml
            + "        </td></tr>"
            + "        <!-- Message Content -->"
            + "        <tr><td style=\"padding: 20px 40px 40px 40px;\">"
            + "          <div style=\"color: #e5e7eb; font-size: 16px; line-height: 1.6;\">"
            +            messageBody // <-- Your message (e.g., "Welcome...", "Your OTP is...") goes here
            + "          </div>"
            + "        </td></tr>"
            + "        <!-- Footer -->"
            + "        <tr><td align=\"center\" style=\"padding: 20px 40px 40px 40px; border-top: 1px solid #374151; font-size: 12px; color: #6b7280;\">"
            + "          <p>&copy; 2025 Conify. All rights reserved.</p>"
            + "        </td></tr>"
            + "      </table>"
            + "    </td></tr>"
            + "  </table>"
            + "</body>"
            + "</html>";
    }
}