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

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${mail.sender.email}")
    private String senderEmail;

    // ── OTP — synchronous so errors surface immediately ──────────────────────
    public void sendOtpEmail(String toEmail, String otp, String recipientName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Smart Inventory - Email Verification OTP");
            helper.setText(buildOtpEmailTemplate(recipientName, otp), true);
            mailSender.send(message);
            log.info("OTP email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send OTP email to {}: {}", toEmail, e.getMessage());
            throw new RuntimeException("Failed to send OTP email: " + e.getMessage(), e);
        }
    }

    // ── Invoice email to customer ────────────────────────────────────────────
    @Async
    public void sendInvoiceEmail(String toEmail, String customerName, String invoiceNumber,
                                  String shopName, List<String[]> items,
                                  double subtotal, double discountPct,
                                  double discountAmt, double total) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Invoice " + invoiceNumber + " from " + shopName);
            helper.setText(buildInvoiceEmailTemplate(customerName, invoiceNumber, shopName,
                    items, subtotal, discountPct, discountAmt, total), true);
            mailSender.send(message);
            log.info("Invoice email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send invoice email to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Stock verification reminder ──────────────────────────────────────────
    @Async
    public void sendStockVerificationReminder(String toEmail, String adminName) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Smart Inventory - Daily Stock Verification Reminder");
            helper.setText(buildStockReminderTemplate(adminName), true);
            mailSender.send(message);
            log.info("Stock verification reminder sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send stock reminder to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Theft alert ──────────────────────────────────────────────────────────
    @Async
    public void sendTheftAlertEmail(String toEmail, String adminName, String productName,
                                     int missingQty, double lossValue) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Smart Inventory - THEFT ALERT: " + productName);
            helper.setText(buildTheftAlertTemplate(adminName, productName, missingQty, lossValue), true);
            mailSender.send(message);
            log.info("Theft alert email sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send theft alert to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Enhanced inventory loss alert with damage breakdown ──────────────────
    @Async
    public void sendInventoryLossAlert(String toEmail, String adminName, String productName,
                                        int expectedStock, int actualStock, int damagedQty,
                                        int unexplainedLoss, double lossValue,
                                        java.time.LocalDate detectionDate) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(senderEmail);
            helper.setTo(toEmail);
            helper.setSubject("Smart Inventory - Possible Inventory Loss: " + productName);
            helper.setText(buildInventoryLossTemplate(adminName, productName,
                    expectedStock, actualStock, damagedQty, unexplainedLoss, lossValue, detectionDate), true);
            mailSender.send(message);
            log.info("Inventory loss alert sent to: {}", toEmail);
        } catch (MessagingException e) {
            log.error("Failed to send inventory loss alert to {}: {}", toEmail, e.getMessage());
        }
    }

    // ── Templates ────────────────────────────────────────────────────────────

    private String buildOtpEmailTemplate(String name, String otp) {
        return """
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8">
                <style>
                  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
                  .c{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);}
                  .h{background:linear-gradient(135deg,#6c63ff,#9c87fc);padding:40px 30px;text-align:center;}
                  .h h1{color:white;margin:0;font-size:28px;}
                  .h p{color:rgba(255,255,255,.9);margin:8px 0 0;font-size:14px;}
                  .b{padding:40px 30px;}
                  .b p{color:#555;line-height:1.6;font-size:15px;}
                  .otp{background:linear-gradient(135deg,#6c63ff,#9c87fc);border-radius:10px;padding:25px;text-align:center;margin:30px 0;}
                  .code{font-size:48px;font-weight:bold;color:white;letter-spacing:12px;margin:0;}
                  .note{color:rgba(255,255,255,.85);font-size:13px;margin:10px 0 0;}
                  .f{background:#f8f8f8;padding:20px 30px;text-align:center;border-top:1px solid #eee;}
                  .f p{color:#999;font-size:12px;margin:0;}
                </style>
                </head>
                <body>
                  <div class="c">
                    <div class="h"><h1>Smart Inventory</h1><p>Theft Detection &amp; Billing System</p></div>
                    <div class="b">
                      <p>Hello <strong>%s</strong>,</p>
                      <p>Please use the OTP below to verify your email address:</p>
                      <div class="otp"><p class="code">%s</p><p class="note">Expires in 10 minutes</p></div>
                      <p>If you didn't request this, please ignore this email.</p>
                    </div>
                    <div class="f"><p>&copy; 2024 Smart Inventory System</p></div>
                  </div>
                </body></html>
                """.formatted(name, otp);
    }

    private String buildInvoiceEmailTemplate(String customerName, String invoiceNumber,
                                              String shopName, List<String[]> items,
                                              double subtotal, double discountPct,
                                              double discountAmt, double total) {
        StringBuilder rows = new StringBuilder();
        for (String[] item : items) {
            rows.append(String.format(
                "<tr>" +
                "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;color:#374151;'>%s</td>" +
                "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:center;color:#374151;'>%s</td>" +
                "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#374151;'>%s</td>" +
                "<td style='padding:10px 12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600;color:#1e1b4b;'>%s</td>" +
                "</tr>",
                item[0], item[1], item[2], item[3]));
        }

        String discountRow = discountPct > 0
                ? String.format(
                    "<tr><td colspan='3' style='padding:8px 12px;text-align:right;color:#6b7280;font-size:13px;'>" +
                    "Discount (%.2f%%)</td>" +
                    "<td style='padding:8px 12px;text-align:right;color:#dc2626;font-weight:600;'>-%.2f</td></tr>",
                    discountPct, discountAmt)
                : "";

        return "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0;'>"
             + "<div style='max-width:600px;margin:0 auto;background:white;border-radius:12px;"
             + "overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);'>"
             + "<div style='background:linear-gradient(135deg,#6c63ff,#9c87fc);padding:32px 30px;text-align:center;'>"
             + "<h1 style='color:white;margin:0;font-size:24px;'>" + shopName + "</h1>"
             + "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;'>Invoice Receipt</p></div>"
             + "<div style='padding:30px;'>"
             + "<p style='color:#374151;font-size:15px;margin-bottom:8px;'>Hello <strong>" + customerName + "</strong>,</p>"
             + "<p style='color:#6b7280;font-size:14px;margin-bottom:20px;'>Thank you for your purchase. Here is your invoice summary.</p>"
             + "<div style='background:#f5f3ff;border-radius:8px;padding:12px 16px;margin-bottom:20px;"
             + "display:flex;justify-content:space-between;align-items:center;'>"
             + "<span style='color:#6b7280;font-size:13px;'>Invoice Number</span>"
             + "<strong style='color:#6c63ff;font-size:14px;'>" + invoiceNumber + "</strong></div>"
             + "<table style='width:100%;border-collapse:collapse;'>"
             + "<thead><tr style='background:linear-gradient(135deg,#6c63ff,#9c87fc);'>"
             + "<th style='padding:11px 12px;color:white;text-align:left;font-size:13px;'>Product</th>"
             + "<th style='padding:11px 12px;color:white;text-align:center;font-size:13px;'>Qty</th>"
             + "<th style='padding:11px 12px;color:white;text-align:right;font-size:13px;'>Unit Price</th>"
             + "<th style='padding:11px 12px;color:white;text-align:right;font-size:13px;'>Total</th></tr></thead>"
             + "<tbody>" + rows.toString()
             + String.format("<tr><td colspan='3' style='padding:10px 12px;text-align:right;color:#6b7280;'>Subtotal</td>"
                     + "<td style='padding:10px 12px;text-align:right;font-weight:700;color:#1e1b4b;'>%.2f</td></tr>",
                     subtotal)
             + discountRow
             + String.format("<tr style='background:#f5f3ff;border-top:2px solid #6c63ff;'>"
                     + "<td colspan='3' style='padding:13px 12px;text-align:right;font-weight:800;font-size:15px;color:#1e1b4b;'>Total Amount</td>"
                     + "<td style='padding:13px 12px;text-align:right;font-weight:800;font-size:15px;color:#6c63ff;'>%.2f</td></tr>",
                     total)
             + "</tbody></table></div>"
             + "<div style='background:#f8f8f8;padding:20px 30px;text-align:center;border-top:1px solid #eee;'>"
             + "<p style='color:#9ca3af;font-size:12px;margin:0;'>Thank you for shopping with us! &mdash; <strong>" + shopName + "</strong></p>"
             + "</div></div></body></html>";
    }

    private String buildStockReminderTemplate(String adminName) {
        return """
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8">
                <style>
                  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
                  .c{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);}
                  .h{background:linear-gradient(135deg,#6c63ff,#9c87fc);padding:40px 30px;text-align:center;}
                  .h h1{color:white;margin:0;font-size:24px;}
                  .b{padding:40px 30px;}
                  .b p{color:#555;line-height:1.6;font-size:15px;}
                  .box{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:20px;margin:20px 0;text-align:center;}
                  .box h2{color:#5b21b6;margin:0 0 10px;}
                  .box p{color:#5b21b6;margin:0;}
                  .btn{display:inline-block;background:linear-gradient(135deg,#6c63ff,#9c87fc);color:white;padding:14px 30px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:15px;margin:20px 0;}
                  .f{background:#f8f8f8;padding:20px 30px;text-align:center;border-top:1px solid #eee;}
                  .f p{color:#999;font-size:12px;margin:0;}
                </style>
                </head>
                <body>
                  <div class="c">
                    <div class="h"><h1>Stock Verification Reminder</h1></div>
                    <div class="b">
                      <p>Hello <strong>%s</strong>,</p>
                      <div class="box"><h2>Daily Stock Verification Required</h2>
                        <p>Please verify today's remaining stock to detect any discrepancies.</p></div>
                      <p>It's 8:00 PM — time to count your inventory and enter the actual stock quantities.</p>
                      <p style="text-align:center"><a href="http://localhost:5173/theft-detection" class="btn">Verify Stock Now</a></p>
                    </div>
                    <div class="f"><p>&copy; 2024 Smart Inventory System</p></div>
                  </div>
                </body></html>
                """.formatted(adminName);
    }

    private String buildInventoryLossTemplate(String adminName, String productName,
                                               int expectedStock, int actualStock,
                                               int damagedQty, int unexplainedLoss,
                                               double lossValue, java.time.LocalDate date) {
        return "<html><body style='font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;margin:0;'>"
             + "<div style='max-width:600px;margin:0 auto;background:white;border-radius:12px;"
             + "overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.1);'>"
             + "<div style='background:linear-gradient(135deg,#6c63ff,#9c87fc);padding:32px 30px;text-align:center;'>"
             + "<h1 style='color:white;margin:0;font-size:22px;'>⚠️ Possible Inventory Loss Detected</h1>"
             + "<p style='color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;'>Smart Inventory System</p></div>"
             + "<div style='padding:30px;'>"
             + "<p style='color:#374151;font-size:15px;margin-bottom:6px;'>Hello <strong>" + adminName + "</strong>,</p>"
             + "<p style='color:#6b7280;font-size:14px;margin-bottom:24px;'>A stock discrepancy has been detected that cannot be fully explained by recorded damage. Please review:</p>"
             + "<table style='width:100%;border-collapse:collapse;margin-bottom:20px;'>"
             + "<tr style='background:linear-gradient(135deg,#6c63ff,#9c87fc);'>"
             + "<th style='padding:11px 14px;color:white;text-align:left;font-size:13px;'>Field</th>"
             + "<th style='padding:11px 14px;color:white;text-align:right;font-size:13px;'>Value</th></tr>"
             + "<tr style='background:#f9f8ff;'><td style='padding:10px 14px;color:#374151;font-size:14px;'><strong>Product</strong></td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:700;color:#1e1b4b;'>" + productName + "</td></tr>"
             + "<tr><td style='padding:10px 14px;color:#374151;font-size:14px;'>Expected Stock</td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:600;color:#1e1b4b;'>" + expectedStock + " units</td></tr>"
             + "<tr style='background:#f9f8ff;'><td style='padding:10px 14px;color:#374151;font-size:14px;'>Actual Stock</td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:600;color:#1e1b4b;'>" + actualStock + " units</td></tr>"
             + "<tr><td style='padding:10px 14px;color:#374151;font-size:14px;'>Recorded Damage</td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:600;color:#d97706;'>" + damagedQty + " units</td></tr>"
             + "<tr style='background:#fff1f2;'><td style='padding:10px 14px;color:#991b1b;font-size:14px;font-weight:700;'>Unexplained Difference</td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:800;color:#dc2626;'>" + unexplainedLoss + " units</td></tr>"
             + "<tr style='background:#fef2f2;'><td style='padding:10px 14px;color:#991b1b;font-size:14px;font-weight:700;'>Estimated Loss Value</td>"
             + "<td style='padding:10px 14px;text-align:right;font-weight:800;color:#dc2626;'>&#8377;" + String.format("%.2f", lossValue) + "</td></tr>"
             + "<tr style='background:#f9f8ff;'><td style='padding:10px 14px;color:#374151;font-size:14px;'>Detection Date</td>"
             + "<td style='padding:10px 14px;text-align:right;color:#1e1b4b;'>" + date + "</td></tr>"
             + "</table>"
             + "<div style='background:#fef3c7;border:1px solid #fbbf24;border-radius:10px;padding:14px 16px;margin-bottom:20px;'>"
             + "<p style='color:#92400e;margin:0;font-size:14px;'><strong>Action Required:</strong> "
             + "Please verify the inventory records and review CCTV footage for the affected product.</p></div>"
             + "<p style='color:#6b7280;font-size:13px;margin:0;'>Log in to your Smart Inventory dashboard to investigate and update the loss record status.</p>"
             + "</div>"
             + "<div style='background:#f8f8f8;padding:18px 30px;text-align:center;border-top:1px solid #eee;'>"
             + "<p style='color:#9ca3af;font-size:12px;margin:0;'>&copy; 2024 Smart Inventory System</p>"
             + "</div></div></body></html>";
    }

    private String buildTheftAlertTemplate(String adminName, String productName,
                                            int missingQty, double lossValue) {
        return """
                <!DOCTYPE html>
                <html>
                <head><meta charset="UTF-8">
                <style>
                  body{font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:20px;}
                  .c{max-width:600px;margin:0 auto;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);}
                  .h{background:linear-gradient(135deg,#ef4444,#dc2626);padding:40px 30px;text-align:center;}
                  .h h1{color:white;margin:0;font-size:24px;}
                  .b{padding:40px 30px;}
                  .b p{color:#555;line-height:1.6;font-size:15px;}
                  table{width:100%%;border-collapse:collapse;margin:20px 0;}
                  th,td{border:1px solid #ddd;padding:12px;text-align:left;}
                  th{background:#6c63ff;color:white;}
                  tr:nth-child(even){background:#f9f9f9;}
                  .f{background:#f8f8f8;padding:20px 30px;text-align:center;border-top:1px solid #eee;}
                  .f p{color:#999;font-size:12px;margin:0;}
                </style>
                </head>
                <body>
                  <div class="c">
                    <div class="h"><h1>THEFT ALERT DETECTED</h1></div>
                    <div class="b">
                      <p>Hello <strong>%s</strong>,</p>
                      <p>A stock discrepancy has been detected. Please review:</p>
                      <table>
                        <tr><th>Field</th><th>Details</th></tr>
                        <tr><td>Product Name</td><td><strong>%s</strong></td></tr>
                        <tr><td>Missing Quantity</td><td><strong style="color:red">%d units</strong></td></tr>
                        <tr><td>Estimated Loss</td><td><strong style="color:red">%.2f</strong></td></tr>
                      </table>
                      <p>Please log in to investigate and update the theft record.</p>
                    </div>
                    <div class="f"><p>&copy; 2024 Smart Inventory System</p></div>
                  </div>
                </body></html>
                """.formatted(adminName, productName, missingQty, lossValue);
    }
}
