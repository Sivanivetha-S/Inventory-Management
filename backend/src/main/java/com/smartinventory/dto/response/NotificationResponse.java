package com.smartinventory.dto.response;

import com.smartinventory.document.Notification;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class NotificationResponse {
    private String id;
    private Long adminId;
    private String type;
    private String message;
    private String referenceType;
    private Long referenceId;
    private boolean read;
    private Long branchId;
    private LocalDateTime createdAt;

    public static NotificationResponse from(Notification n) {
        return NotificationResponse.builder()
                .id(n.getId())
                .adminId(n.getAdminId())
                .branchId(n.getBranchId())
                .type(n.getType())
                .message(n.getMessage())
                .referenceType(n.getReferenceType())
                .referenceId(n.getReferenceId())
                .read(n.isRead())
                .createdAt(n.getCreatedAt())
                .build();
    }
}
