package com.smartinventory.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

@Service
@Slf4j
public class GeminiVisionService {

    public static class GeminiDamageResult {
        private boolean genuineDamage;
        private double confidenceScore;
        private String reason;

        public boolean isGenuineDamage() { return genuineDamage; }
        public void setGenuineDamage(boolean genuineDamage) { this.genuineDamage = genuineDamage; }
        public double getConfidenceScore() { return confidenceScore; }
        public void setConfidenceScore(double confidenceScore) { this.confidenceScore = confidenceScore; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
    }

    private final ThreadLocal<String> lastError = new ThreadLocal<>();

    public String getLastError() {
        return lastError.get();
    }

    public GeminiDamageResult verifyDamage(String productName, List<MultipartFile> files) {
        lastError.remove();
        String apiKey = getGeminiApiKey();
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("Gemini API key is not configured.");
            return null;
        }

        try {
            // Build Prompt text
            String prompt = "You are an expert AI Damage Verification agent for a retail store's inventory returns workflow.\n"
                    + "Analyze the provided image(s) of a product return request.\n"
                    + "The product name is: \"" + escapeJson(productName) + "\".\n\n"
                    + "Verify the following:\n"
                    + "1. Product Match: Do the uploaded images contain the product \"" + escapeJson(productName) + "\" or any brand/variant/type of it? (Be lenient: if the specified product is generic like \"soap\" or \"Rice\", and the image shows a specific brand like \"Dettol\" or \"Dove\" or \"Daawat\", this is a VALID match).\n"
                    + "2. Damage Check: Is the product visibly damaged, broken, cracked, torn, leaking, dented, expired, or does it have damaged packaging/box? (Be cooperative: if there is visible evidence of packaging damage, wear, or an expiration date indicating exp, it is DAMAGED).\n"
                    + "3. Image Quality: Is the image clear enough to identify the product and damage? (Do not reject unless it is completely black, completely blurry, or impossible to see).\n"
                    + "4. Integrity Check: Is the image NOT a screenshot, selfie, or completely unrelated random object?\n\n"
                    + "Respond ONLY with a JSON object in this exact format. Do not include markdown code block wrappers (like ```json ... ```). Return raw JSON:\n"
                    + "{\n"
                    + "  \"genuineDamage\": true or false,\n"
                    + "  \"confidenceScore\": a number between 0.0 and 1.0,\n"
                    + "  \"reason\": \"Brief explanation of your findings\"\n"
                    + "}";

            StringBuilder partsBuilder = new StringBuilder();
            partsBuilder.append("{\"text\":\"").append(escapeJson(prompt)).append("\"}");

            for (MultipartFile file : files) {
                if (file == null || file.isEmpty()) continue;
                String mimeType = file.getContentType();
                if (mimeType == null || mimeType.isBlank()) {
                    mimeType = "image/jpeg";
                }
                byte[] bytes = file.getBytes();
                String base64Data = Base64.getEncoder().encodeToString(bytes);

                partsBuilder.append(",{\"inlineData\":{")
                        .append("\"mimeType\":\"").append(mimeType).append("\",")
                        .append("\"data\":\"").append(base64Data).append("\"")
                        .append("}}");
            }

            String payload = "{\"contents\":[{\"parts\":[" + partsBuilder.toString() + "]}],"
                    + "\"generationConfig\":{\"temperature\":0.1,\"responseMimeType\":\"application/json\",\"maxOutputTokens\":512}}";

            log.info("Sending payload to Gemini Vision API... (without base64 log payload length = {})", payload.length());
            
            HttpResponse<String> response = null;
            int retries = 3;
            String[] models = {"gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"};
            
            for (int i = 0; i < retries; i++) {
                String model = models[i % models.length];
                String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey;
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                        .build();
                
                response = HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
                
                if (response.statusCode() == 200) {
                    break;
                }
                
                log.warn("Gemini API call returned status code {} on attempt {} with model {}. Error body: {}", 
                         response.statusCode(), i + 1, model, response.body());
                
                if (response.statusCode() == 429) {
                    try {
                        Thread.sleep(1500 * (i + 1));
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                }
            }
            
            if (response == null || response.statusCode() != 200) {
                String errorMsg = "HTTP " + (response != null ? response.statusCode() : "unknown");
                if (response != null && response.body() != null) {
                    try {
                        ObjectMapper mapper = new ObjectMapper();
                        JsonNode root = mapper.readTree(response.body());
                        if (root.has("error")) {
                            JsonNode errNode = root.get("error");
                            if (errNode.has("message")) {
                                errorMsg = errNode.get("message").asText();
                            } else if (errNode.has("status")) {
                                errorMsg = errNode.get("status").asText();
                            }
                        }
                    } catch (Exception ignored) {}
                }
                lastError.set(errorMsg);
                log.warn("All retry attempts failed. Final response status: {}, error: {}", response != null ? response.statusCode() : "null", errorMsg);
                return null;
            }

            String responseBody = response.body();
            String rawJson = extractGeminiText(responseBody);
            if (rawJson == null || rawJson.isBlank()) {
                log.warn("Could not extract text content from Gemini Vision response.");
                return null;
            }

            log.info("Gemini Vision raw response: {}", rawJson);
            return parseResult(rawJson);

        } catch (Exception e) {
            log.warn("Gemini Vision service request failed: {}", e.getMessage());
            return null;
        }
    }

    private GeminiDamageResult parseResult(String rawJson) {
        String cleanJson = rawJson.trim();
        if (cleanJson.startsWith("```")) {
            int firstNewline = cleanJson.indexOf('\n');
            int lastTicks = cleanJson.lastIndexOf("```");
            if (firstNewline > 0 && lastTicks > firstNewline) {
                cleanJson = cleanJson.substring(firstNewline + 1, lastTicks).trim();
            }
        }

        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(cleanJson);
            
            GeminiDamageResult result = new GeminiDamageResult();
            
            boolean genuineDamage = false;
            if (root.has("genuineDamage")) {
                genuineDamage = root.get("genuineDamage").asBoolean();
            } else if (root.has("genuine_damage")) {
                genuineDamage = root.get("genuine_damage").asBoolean();
            }
            
            double confidenceScore = 0.0;
            if (root.has("confidenceScore")) {
                confidenceScore = root.get("confidenceScore").asDouble();
            } else if (root.has("confidence_score")) {
                confidenceScore = root.get("confidence_score").asDouble();
            }
            
            String reason = "Parsed successfully";
            if (root.has("reason")) {
                reason = root.get("reason").asText();
            }
            
            result.setGenuineDamage(genuineDamage);
            result.setConfidenceScore(confidenceScore);
            result.setReason(reason);
            return result;
        } catch (Exception e) {
            log.warn("Jackson failed to parse. Falling back to manual parse: {}. Content: {}", e.getMessage(), cleanJson);
            try {
                GeminiDamageResult result = new GeminiDamageResult();
                
                boolean genuineDamage = false;
                double confidenceScore = 0.0;
                String reason = "Parsed successfully";

                int genuineIndex = cleanJson.indexOf("\"genuineDamage\"");
                if (genuineIndex >= 0) {
                    int colonIndex = cleanJson.indexOf(':', genuineIndex);
                    if (colonIndex >= 0) {
                        String sub = cleanJson.substring(colonIndex + 1).trim();
                        if (sub.startsWith("true")) {
                            genuineDamage = true;
                        }
                    }
                }

                int scoreIndex = cleanJson.indexOf("\"confidenceScore\"");
                if (scoreIndex >= 0) {
                    int colonIndex = cleanJson.indexOf(':', scoreIndex);
                    if (colonIndex >= 0) {
                        String sub = cleanJson.substring(colonIndex + 1).trim();
                        StringBuilder sb = new StringBuilder();
                        for (int i = 0; i < sub.length(); i++) {
                            char c = sub.charAt(i);
                            if (Character.isDigit(c) || c == '.') {
                                sb.append(c);
                            } else {
                                break;
                            }
                        }
                        try {
                            confidenceScore = Double.parseDouble(sb.toString());
                        } catch (NumberFormatException ignored) {}
                    }
                }

                int reasonIndex = cleanJson.indexOf("\"reason\"");
                if (reasonIndex >= 0) {
                    int colonIndex = cleanJson.indexOf(':', reasonIndex);
                    if (colonIndex >= 0) {
                        int quoteStart = cleanJson.indexOf('"', colonIndex + 1);
                        if (quoteStart >= 0) {
                            int quoteEnd = quoteStart + 1;
                            while (quoteEnd < cleanJson.length()) {
                                quoteEnd = cleanJson.indexOf('"', quoteEnd);
                                if (quoteEnd < 0) break;
                                if (cleanJson.charAt(quoteEnd - 1) != '\\') break;
                                quoteEnd++;
                            }
                            if (quoteEnd > quoteStart) {
                                reason = cleanJson.substring(quoteStart + 1, quoteEnd);
                            }
                        }
                    }
                }

                result.setGenuineDamage(genuineDamage);
                result.setConfidenceScore(confidenceScore);
                result.setReason(unescapeJson(reason));
                return result;
            } catch (Exception ex) {
                log.warn("Manual parse also failed: {}", ex.getMessage());
                return null;
            }
        }
    }

    private String extractGeminiText(String response) {
        int textIndex = response.indexOf("\"text\":");
        if (textIndex < 0) return null;
        int start = response.indexOf('"', textIndex + 7);
        if (start < 0) return null;
        int end = start + 1;
        while (end < response.length()) {
            end = response.indexOf('"', end);
            if (end < 0) return null;
            if (response.charAt(end - 1) != '\\') break;
            end++;
        }
        return unescapeJson(response.substring(start + 1, end));
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }

    private String unescapeJson(String value) {
        return value.replace("\\n", "\n").replace("\\\"", "\"").replace("\\\\", "\\").replace("\\r", "\r").replace("\\t", "\t");
    }

    private String getGeminiApiKey() {
        String key = System.getenv("GEMINI_API_KEY");
        if (key == null || key.isBlank()) key = System.getenv("VITE_GEMINI_API_KEY");
        if (key != null && !key.isBlank()) return key;
        try {
            Path environmentFile = Path.of("../frontend/.env");
            if (Files.exists(environmentFile)) {
                return Files.readAllLines(environmentFile).stream()
                        .filter(line -> line.trim().startsWith("VITE_GEMINI_API_KEY="))
                        .map(line -> line.split("=", 2)[1].trim())
                        .findFirst()
                        .orElse("");
            }
        } catch (Exception exception) {
            log.warn("Unable to read Gemini configuration: {}", exception.getMessage());
        }
        try {
            Path envFile = Path.of(".env");
            if (Files.exists(envFile)) {
                return Files.readAllLines(envFile).stream()
                        .filter(line -> line.trim().startsWith("GEMINI_API_KEY="))
                        .map(line -> line.split("=", 2)[1].trim())
                        .findFirst()
                        .orElse("");
            }
        } catch (Exception exception) {
            log.warn("Unable to read root configuration: {}", exception.getMessage());
        }
        return "";
    }
}
