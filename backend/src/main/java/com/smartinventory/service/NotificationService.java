package com.smartinventory.service;

import com.smartinventory.document.Notification;
import com.smartinventory.dto.response.ApiResponse;
import com.smartinventory.dto.response.NotificationResponse;
import com.smartinventory.entity.Admin;
import com.smartinventory.repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;

    // ── Create a notification ─────────────────────────────────────────────────
    public void createNotification(Long adminId, String type, String message, String refType) {
        createNotification(adminId, null, type, message, refType, null);
    }

    public void createNotification(Long adminId, String type, String message,
                                   String refType, Long refId) {
        createNotification(adminId, null, type, message, refType, refId);
    }

    public void createNotification(Long adminId, Long branchId, String type, String message,
                                   String refType, Long refId) {
        Notification n = Notification.builder()
                .adminId(adminId)
                .branchId(branchId)
                .type(type)
                .message(message)
                .referenceType(refType)
                .referenceId(refId)
                .read(false)
                .build();
        notificationRepository.save(n);
    }

    // ── Get all notifications for current target ───────────────────────────────
    public ApiResponse<List<NotificationResponse>> getAll(int page, int size) {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (targetId > 0 && branchId == null) {
            List<com.smartinventory.entity.Branch> branches = branchRepository.findAllByAdminId(targetId);
            if (branches != null && !branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<NotificationResponse> list = (targetId < 0
                ? notificationRepository.findAllByAdminIdOrderByCreatedAtDesc(targetId, PageRequest.of(page, size))
                : notificationRepository.findAllByAdminIdAndBranchIdOrderByCreatedAtDesc(targetId, branchId, PageRequest.of(page, size)))
                .stream()
                .map(NotificationResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Notifications retrieved", list);
    }

    // ── Get unread count ──────────────────────────────────────────────────────
    public ApiResponse<Long> getUnreadCount() {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (targetId > 0 && branchId == null) {
            List<com.smartinventory.entity.Branch> branches = branchRepository.findAllByAdminId(targetId);
            if (branches != null && !branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        long count = (targetId < 0
                ? notificationRepository.findAllByAdminIdAndReadFalseOrderByCreatedAtDesc(targetId)
                : notificationRepository.findAllByAdminIdAndBranchIdAndReadFalseOrderByCreatedAtDesc(targetId, branchId))
                .size();
        return ApiResponse.success("Unread count", count);
    }

    // ── Get unread notifications ──────────────────────────────────────────────
    public ApiResponse<List<NotificationResponse>> getUnread() {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        if (targetId > 0 && branchId == null) {
            List<com.smartinventory.entity.Branch> branches = branchRepository.findAllByAdminId(targetId);
            if (branches != null && !branches.isEmpty()) {
                throw new RuntimeException("Branch selection is required");
            }
        }
        List<NotificationResponse> list = (targetId < 0
                ? notificationRepository.findAllByAdminIdAndReadFalseOrderByCreatedAtDesc(targetId)
                : notificationRepository.findAllByAdminIdAndBranchIdAndReadFalseOrderByCreatedAtDesc(targetId, branchId))
                .stream()
                .map(NotificationResponse::from).collect(Collectors.toList());
        return ApiResponse.success("Unread notifications", list);
    }

    // ── Mark one as read ──────────────────────────────────────────────────────
    public ApiResponse<String> markRead(String id) {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        Notification n = (targetId < 0
                ? notificationRepository.findById(id)
                : notificationRepository.findByIdAndAdminIdAndBranchId(id, targetId, branchId))
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        n.setRead(true);
        notificationRepository.save(n);
        return ApiResponse.success("Marked as read", "OK");
    }

    // ── Mark all as read ──────────────────────────────────────────────────────
    public ApiResponse<String> markAllRead() {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        List<Notification> unread = targetId < 0
                ? notificationRepository.findAllByAdminIdAndReadFalseOrderByCreatedAtDesc(targetId)
                : notificationRepository.findAllByAdminIdAndBranchIdAndReadFalseOrderByCreatedAtDesc(targetId, branchId);
        unread.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(unread);
        return ApiResponse.success("All notifications marked as read", "OK");
    }

    // ── Delete one notification ───────────────────────────────────────────────
    public ApiResponse<String> delete(String id) {
        Long targetId = currentTargetId();
        Long branchId = securityUtils.getCurrentBranchId();
        Notification notification = (targetId < 0
                ? notificationRepository.findById(id)
                : notificationRepository.findByIdAndAdminIdAndBranchId(id, targetId, branchId))
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notificationRepository.delete(notification);
        return ApiResponse.success("Notification deleted", "OK");
    }

    private final com.smartinventory.repository.AdminRepository adminRepository;
    private final com.smartinventory.repository.SupplierRepository supplierRepository;
    private final com.smartinventory.repository.StaffRepository staffRepository;
    private final com.smartinventory.util.SecurityUtils securityUtils;
    private final com.smartinventory.repository.BranchRepository branchRepository;

    // ── Helper ────────────────────────────────────────────────────────────────
    private Long currentTargetId() {
        String email = SecurityContextHolder.getContext().getAuthentication().getName();
        org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();

        boolean isSupplier = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_SUPPLIER"));
        boolean isAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN"));

        if (isAdmin) {
            var adminOpt = adminRepository.findByEmail(email);
            if (adminOpt.isPresent()) return adminOpt.get().getId();
        } else if (isSupplier) {
            var supplierOpt = supplierRepository.findByEmail(email);
            if (supplierOpt.isPresent()) return -supplierOpt.get().getId();
        } else {
            var staffOpt = staffRepository.findByEmail(email);
            if (staffOpt.isPresent()) return staffOpt.get().getAdmin().getId();
        }
        throw new RuntimeException("Unauthorized user access");
    }
}
