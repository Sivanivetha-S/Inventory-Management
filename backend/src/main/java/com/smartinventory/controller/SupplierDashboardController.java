package com.smartinventory.controller;

import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.SupplierDashboardResponse;
import com.smartinventory.service.SupplierDashboardService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/supplier-dashboard")
@RequiredArgsConstructor
public class SupplierDashboardController {

    private final SupplierDashboardService service;

    @GetMapping
    public ResponseEntity<ApiResponse<SupplierDashboardResponse>> getDashboard() {
        return ResponseEntity.ok(service.getDashboardData());
    }
}
