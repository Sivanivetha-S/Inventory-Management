package com.smartinventory.dto.response;

import com.smartinventory.entity.SupplierProduct;
import com.smartinventory.entity.SupplierTheftRecord;
import lombok.*;
import java.util.List;

@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SupplierDashboardResponse {
    private long totalProducts;
    private long totalStock;
    private long todayDispatches;
    private long pendingRequests;
    private long acceptedRequests;
    private long rejectedRequests;
    private List<SupplierProduct> lowStockProducts;
    private List<SupplierTheftRecord> theftAlerts;
}
