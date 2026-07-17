package com.smartinventory.controller;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.service.ChatbotService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
public class ChatbotController {

    private final ChatbotService service;

    @PostMapping
    public ResponseEntity<ApiResponse<Map<String, String>>> chat(
            @RequestBody Map<String, Object> request) {
        String message = (String) request.get("message");
        List<Map<String, String>> history = (List<Map<String, String>>) request.get("history");
        
        String reply = service.generateChatResponse(message, history);
        return ResponseEntity.ok(ApiResponse.success("Success", Map.of("response", reply)));
    }
}
