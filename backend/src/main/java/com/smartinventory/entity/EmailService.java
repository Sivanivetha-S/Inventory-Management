package com.smartinventory.email;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${mail.sender.email}")
    private String senderEmail;

    @Value("${otp.expiry.minutes:10}")
    private int otpExpiryMinutes;

    // ── OTP (synchronous) ─────────────────────────────────────────────────────
    public void sendOtpEmail(String toEmail, String otp, String recipientName) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — Email Verification OTP");
            h.setText(buildOtpEmailTemplate(recipientName, otp, otpExpiryMinutes), true);
            mailSender.send(msg);
            log.info("OTP email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send OTP email: " + e.getMessage(), e);
        }
    }

    // ── Supplier OTP ──────────────────────────────────────────────────────────
    @Async
    public void sendSupplierOtpEmail(String toEmail, String supplierName, String otp) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — Supplier Email Verification");
            h.setText(buildOtpEmailTemplate(supplierName, otp, otpExpiryMinutes), true);
            mailSender.send(msg);
            log.info("Supplier OTP sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send supplier OTP to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Staff welcome email ───────────────────────────────────────────────────
    @Async
    public void sendStaffWelcomeEmail(String toEmail, String staffName,
                                       String shopName, String tempPassword) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Welcome to " + shopName + " — Your Staff Account");
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
                  <h2 style="color:#4F46E5;">Welcome, %s!</h2>
                  <p>You have been added as staff at <strong>%s</strong>.</p>
                  <div style="background:#EEF2FF;padding:16px;border-radius:8px;margin:16px 0;">
                    <p><strong>Email:</strong> %s</p>
                    <p><strong>Password:</strong> %s</p>
                  </div>
                  <p style="color:#6B7280;font-size:13px;">Please change your password after first login.</p>
                </div></body></html>
                """.formatted(staffName, shopName, toEmail, tempPassword), true);
            mailSender.send(msg);
            log.info("Staff welcome email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send staff welcome email to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Invoice email ─────────────────────────────────────────────────────────
    @Async
    public void sendInvoiceEmail(String toEmail, String customerName, String invoiceNumber,
                                  String shopName, List<String[]> items,
                                  double subtotal, double discountPct,
                                  double discountAmt, double total) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Invoice " + invoiceNumber + " from " + shopName);
            h.setText(buildInvoiceEmailTemplate(customerName, invoiceNumber, shopName,
                    items, subtotal, discountPct, discountAmt, total), true);
            mailSender.send(msg);
            log.info("Invoice email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send invoice email to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Stock verification reminder ───────────────────────────────────────────
    @Async
    public void sendStockVerificationReminder(String toEmail, String adminName) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — Daily Stock Verification Reminder");
            h.setText(buildStockReminderTemplate(adminName), true);
            mailSender.send(msg);
            log.info("Stock reminder sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send stock reminder to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Theft alert ───────────────────────────────────────────────────────────
    @Async
    public void sendTheftAlertEmail(String toEmail, String adminName, String productName,
                                     int missingQty, double lossValue) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — THEFT ALERT: " + productName);
            h.setText(buildTheftAlertTemplate(adminName, productName, missingQty, lossValue), true);
            mailSender.send(msg);
            log.info("Theft alert sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send theft alert to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Inventory loss alert (with damage breakdown) ──────────────────────────
    @Async
    public void sendInventoryLossAlert(String toEmail, String adminName, String productName,
                                        int expectedStock, int actualStock, int damagedQty,
                                        int unexplainedLoss, double lossValue,
                                        LocalDate detectionDate) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — Possible Inventory Loss: " + productName);
            h.setText(buildInventoryLossTemplate(adminName, productName,
                    expectedStock, actualStock, damagedQty,
                    unexplainedLoss, lossValue, detectionDate), true);
            mailSender.send(msg);
            log.info("Inventory loss alert sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send inventory loss alert to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Supplier Theft Alert ──────────────────────────────────────────────────
    @Async
    public void sendSupplierTheftAlertEmail(String toEmail, String supplierName, String productName,
                                             int expected, int actual, int missing) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Supplier Inventory Theft Alert");
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
                  <h2 style="color:#DC2626;">Supplier Inventory Theft Alert</h2>
                  <p>Hello <strong>%s</strong>, a stock discrepancy has been detected in your inventory.</p>
                  <table style="width:100%%;border-collapse:collapse;margin:20px 0;">
                    <tr><td style="padding:10px;border:1px solid #eee;"><strong>Product</strong></td>
                        <td style="padding:10px;border:1px solid #eee;">%s</td></tr>
                    <tr><td style="padding:10px;border:1px solid #eee;"><strong>Expected</strong></td>
                        <td style="padding:10px;border:1px solid #eee;">%d</td></tr>
                    <tr><td style="padding:10px;border:1px solid #eee;"><strong>Actual</strong></td>
                        <td style="padding:10px;border:1px solid #eee;">%d</td></tr>
                    <tr><td style="padding:10px;border:1px solid #eee;color:#dc2626;"><strong>Missing</strong></td>
                        <td style="padding:10px;border:1px solid #eee;color:#dc2626;font-weight:bold;">%d</td></tr>
                  </table>
                </div></body></html>
                """.formatted(supplierName, productName, expected, actual, missing), true);
            mailSender.send(msg);
            log.info("Supplier theft alert sent to: {}", toEmail);
        } catch (Exception e) {
            log.error("Failed to send supplier theft alert: {}", e.getMessage());
        }
    }

    // ── Supply request notification ───────────────────────────────────────────
    @Async
    public void sendSupplyRequestEmail(String toEmail, String recipientName,
                                        String requesterName, String productName,
                                        int quantity, String direction) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — Supply Request: " + productName);
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
                  <h2 style="color:#4F46E5;">Supply Request</h2>
                  <p>Hello <strong>%s</strong>, <strong>%s</strong> sent a supply request.</p>
                  <table style="width:100%%;border-collapse:collapse;margin-top:16px;">
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Product</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%s</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Quantity</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%d units</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Direction</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%s</td></tr>
                  </table>
                </div></body></html>
                """.formatted(recipientName, requesterName, productName, quantity, direction), true);
            mailSender.send(msg);
        } catch (MessagingException e) {
            log.error("Failed to send supply request email: {}", e.getMessage());
        }
    }

    // ── Stock received notification ───────────────────────────────────────────
    @Async
    public void sendStockReceivedEmail(String toEmail, String adminName,
                                        String staffName, String productName,
                                        int quantity, String batchNumber) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("Smart Inventory — New Stock Added: " + productName);
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
                  <h2 style="color:#16A34A;">Stock Received ✓</h2>
                  <p>Hello <strong>%s</strong>, staff member <strong>%s</strong> added new stock.</p>
                  <table style="width:100%%;border-collapse:collapse;margin-top:16px;">
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Product</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%s</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Quantity</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%d units</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Batch #</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%s</td></tr>
                  </table>
                </div></body></html>
                """.formatted(adminName, staffName, productName, quantity, batchNumber), true);
            mailSender.send(msg);
        } catch (MessagingException e) {
            log.error("Failed to send stock received email: {}", e.getMessage());
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PRIVATE TEMPLATES
    // ═══════════════════════════════════════════════════════════════════════════

    private String buildOtpEmailTemplate(String name, String otp, int expiryMinutes) {
        return """
            <!DOCTYPE html><html><head><meta charset="UTF-8">
            <style>
              body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
              .c{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);}
              .h{background:linear-gradient(135deg,#4338CA,#6366F1);padding:40px 30px;text-align:center;}
              .h h1{color:white;margin:0;font-size:28px;}
              .b{padding:40px 30px;}
              .otp{background:linear-gradient(135deg,#4338CA,#6366F1);border-radius:10px;padding:25px;text-align:center;margin:30px 0;}
              .code{font-size:48px;font-weight:bold;color:white;letter-spacing:12px;margin:0;}
              .note{color:rgba(255,255,255,.85);font-size:13px;margin:10px 0 0;}
              .f{background:#f8f8f8;padding:20px 30px;text-align:center;}
            </style></head><body>
            <div class="c">
              <div class="h"><h1>Smart Inventory</h1></div>
              <div class="b">
                <p>Hello <strong>%s</strong>,</p>
                <p>Your verification OTP:</p>
                <div class="otp"><p class="code">%s</p><p class="note">Expires in %d minutes</p></div>
                <p>If you didn't request this, ignore this email.</p>
              </div>
              <div class="f"><p>&copy; 2024 Smart Inventory System</p></div>
            </div></body></html>
            """.formatted(name, otp, expiryMinutes);
    }

    private String buildInvoiceEmailTemplate(String customerName, String invoiceNumber,
                                              String shopName, List<String[]> items,
                                              double subtotal, double discountPct,
                                              double discountAmt, double total) {
        StringBuilder rows = new StringBuilder();
        for (String[] item : items) {
            rows.append(String.format(
                "<tr><td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;'>%s</td>"
              + "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;'>%s</td>"
              + "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;'>%s</td>"
              + "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;'>%s</td></tr>",
                item[0], item[1], item[2], item[3]));
        }
        String discountRow = discountPct > 0
            ? String.format("<tr><td colspan='3' style='padding:8px 12px;text-align:right;'>Discount (%.2f%%)</td>"
              + "<td style='padding:8px 12px;text-align:right;color:#dc2626;font-weight:600;'>-%.2f</td></tr>",
              discountPct, discountAmt)
            : "";

        return "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;'>"
            + "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;'>"
            + "<div style='background:linear-gradient(135deg,#4338CA,#6366F1);padding:32px 30px;text-align:center;'>"
            + "<h1 style='color:white;margin:0;font-size:24px;'>" + shopName + "</h1>"
            + "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;'>Invoice Receipt</p></div>"
            + "<div style='padding:30px;'>"
            + "<p>Hello <strong>" + customerName + "</strong>, thank you for your purchase.</p>"
            + "<table style='width:100%;border-collapse:collapse;'>"
            + "<thead><tr style='background:linear-gradient(135deg,#4338CA,#6366F1);'>"
            + "<th style='padding:11px 12px;color:white;text-align:left;'>Product</th>"
            + "<th style='padding:11px 12px;color:white;text-align:center;'>Qty</th>"
            + "<th style='padding:11px 12px;color:white;text-align:right;'>Unit</th>"
            + "<th style='padding:11px 12px;color:white;text-align:right;'>Total</th></tr></thead>"
            + "<tbody>" + rows
            + String.format("<tr><td colspan='3' style='padding:10px 12px;text-align:right;'>Subtotal</td>"
              + "<td style='padding:10px 12px;text-align:right;font-weight:700;'>%.2f</td></tr>", subtotal)
            + discountRow
            + String.format("<tr style='background:#EEF2FF;'>"
              + "<td colspan='3' style='padding:13px 12px;text-align:right;font-weight:800;'>Total</td>"
              + "<td style='padding:13px 12px;text-align:right;font-weight:800;color:#4338CA;'>%.2f</td></tr>", total)
            + "</tbody></table></div>"
            + "<div style='background:#f8f8f8;padding:20px 30px;text-align:center;'>"
            + "<p style='color:#9ca3af;font-size:12px;margin:0;'>Thank you — " + shopName + "</p>"
            + "</div></div></body></html>";
    }

    private String buildStockReminderTemplate(String adminName) {
        return """
            <!DOCTYPE html><html><head><meta charset="UTF-8"></head>
            <body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
              <h2 style="color:#4F46E5;">Daily Stock Verification Reminder</h2>
              <p>Hello <strong>%s</strong>,</p>
              <p>It's 8:00 PM — time to verify today's remaining stock.</p>
              <p><a href="http://localhost:5173/theft-detection"
                style="background:#4F46E5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">
                Verify Stock Now</a></p>
              <p style="color:#9ca3af;font-size:12px;">&copy; 2024 Smart Inventory System</p>
            </div></body></html>
            """.formatted(adminName);
    }

    private String buildTheftAlertTemplate(String adminName, String productName,
                                            int missingQty, double lossValue) {
        return """
            <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
            <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;">
              <h2 style="color:#DC2626;">THEFT ALERT DETECTED</h2>
              <p>Hello <strong>%s</strong>, a stock discrepancy has been detected.</p>
              <table style="width:100%%;border-collapse:collapse;margin:20px 0;">
                <tr style="background:#4F46E5;"><th style="padding:10px;color:white;text-align:left;">Field</th>
                    <th style="padding:10px;color:white;text-align:left;">Details</th></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;">Product</td>
                    <td style="padding:10px;border-bottom:1px solid #eee;font-weight:700;">%s</td></tr>
                <tr><td style="padding:10px;border-bottom:1px solid #eee;">Missing</td>
                    <td style="padding:10px;border-bottom:1px solid #eee;color:#DC2626;font-weight:700;">%d units</td></tr>
                <tr><td style="padding:10px;">Est. Loss</td>
                    <td style="padding:10px;color:#DC2626;font-weight:700;">&#8377;%.2f</td></tr>
              </table>
              <p style="color:#9ca3af;font-size:12px;">&copy; 2024 Smart Inventory System</p>
            </div></body></html>
            """.formatted(adminName, productName, missingQty, lossValue);
    }

    private String buildInventoryLossTemplate(String adminName, String productName,
                                               int expectedStock, int actualStock,
                                               int damagedQty, int unexplainedLoss,
                                               double lossValue, LocalDate date) {
        return "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;'>"
            + "<div style='max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;'>"
            + "<h2 style='color:#DC2626;'>⚠️ Possible Inventory Loss: " + productName + "</h2>"
            + "<p>Hello <strong>" + adminName + "</strong>,</p>"
            + "<table style='width:100%;border-collapse:collapse;margin:20px 0;'>"
            + "<tr style='background:#4F46E5;'><th style='padding:10px;color:white;text-align:left;'>Metric</th>"
            + "<th style='padding:10px;color:white;text-align:right;'>Value</th></tr>"
            + "<tr><td style='padding:10px;border-bottom:1px solid #eee;'>Expected Stock</td>"
            + "<td style='padding:10px;border-bottom:1px solid #eee;text-align:right;'>" + expectedStock + "</td></tr>"
            + "<tr><td style='padding:10px;border-bottom:1px solid #eee;'>Actual Stock</td>"
            + "<td style='padding:10px;border-bottom:1px solid #eee;text-align:right;'>" + actualStock + "</td></tr>"
            + "<tr><td style='padding:10px;border-bottom:1px solid #eee;'>Recorded Damage</td>"
            + "<td style='padding:10px;border-bottom:1px solid #eee;text-align:right;color:#D97706;'>" + damagedQty + "</td></tr>"
            + "<tr style='background:#FEF2F2;'><td style='padding:10px;border-bottom:1px solid #eee;font-weight:700;color:#DC2626;'>Unexplained Loss</td>"
            + "<td style='padding:10px;border-bottom:1px solid #eee;text-align:right;font-weight:800;color:#DC2626;'>" + unexplainedLoss + "</td></tr>"
            + "<tr style='background:#FEF2F2;'><td style='padding:10px;font-weight:700;color:#DC2626;'>Est. Loss Value</td>"
            + "<td style='padding:10px;text-align:right;font-weight:800;color:#DC2626;'>&#8377;" + String.format("%.2f", lossValue) + "</td></tr>"
            + "</table>"
            + "<p style='color:#6B7280;font-size:13px;'>Date: " + date + "</p>"
            + "<p style='color:#9ca3af;font-size:12px;'>&copy; 2024 Smart Inventory System</p>"
            + "</div></body></html>";
    }

    @Async
    public void sendLowStockAlertEmail(String toEmail, String recipientName, String productName, int currentStock, int minStock, int recommendedReorder) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("⚠️ Low Stock Alert & Purchase Recommendation: " + productName);
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;border:1px solid #ddd;">
                  <h2 style="color:#D97706;">⚠️ Low Stock Alert</h2>
                  <p>Hello <strong>%s</strong>,</p>
                  <p>Product <strong>%s</strong> has dropped below the minimum stock threshold.</p>
                  <table style="width:100%%;border-collapse:collapse;margin:16px 0;">
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Current Stock</strong></td>
                        <td style="padding:8px;border:1px solid #eee;color:#DC2626;font-weight:bold;">%d units</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Minimum Stock Limit</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%d units</td></tr>
                    <tr style="background:#F0FDF4;"><td style="padding:8px;border:1px solid #eee;font-weight:bold;color:#15803D;">AI Purchase Recommendation</td>
                        <td style="padding:8px;border:1px solid #eee;font-weight:bold;color:#15803D;">Reorder %d units</td></tr>
                  </table>
                  <p style="color:#6B7280;font-size:12px;">This is an automated AI stock optimization alert.</p>
                </div></body></html>
                """.formatted(recipientName, productName, currentStock, minStock, recommendedReorder), true);
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send low stock email: {}", e.getMessage());
        }
    }

    @Async
    public void sendExpiryAlertEmail(String toEmail, String recipientName, String productName, String statusLabel, LocalDate expiryDate) {
        try {
            MimeMessage msg = mailSender.createMimeMessage();
            MimeMessageHelper h = new MimeMessageHelper(msg, true, "UTF-8");
            h.setFrom(senderEmail);
            h.setTo(toEmail);
            h.setSubject("⚠️ Expiry Action Required: " + productName + " (" + statusLabel + ")");
            h.setText("""
                <html><body style="font-family:Arial,sans-serif;padding:20px;">
                <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:10px;padding:32px;border:1px solid #ddd;">
                  <h2 style="color:#DC2626;">%s</h2>
                  <p>Hello <strong>%s</strong>,</p>
                  <p>Product <strong>%s</strong> has triggered an expiration alert.</p>
                  <table style="width:100%%;border-collapse:collapse;margin:16px 0;">
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Status</strong></td>
                        <td style="padding:8px;border:1px solid #eee;color:#DC2626;font-weight:bold;">%s</td></tr>
                    <tr><td style="padding:8px;border:1px solid #eee;"><strong>Expiry Date</strong></td>
                        <td style="padding:8px;border:1px solid #eee;">%s</td></tr>
                  </table>
                  <p style="color:#6B7280;font-size:12px;">Expired products must not be sold and should be disposed of or returned.</p>
                </div></body></html>
                """.formatted(statusLabel, recipientName, productName, statusLabel, expiryDate != null ? expiryDate.toString() : "N/A"), true);
            mailSender.send(msg);
        } catch (Exception e) {
            log.error("Failed to send expiry alert email: {}", e.getMessage());
        }
    }
}
