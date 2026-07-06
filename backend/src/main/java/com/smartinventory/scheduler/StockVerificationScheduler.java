package com.smartinventory.scheduler;

import com.smartinventory.service.TheftDetectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class StockVerificationScheduler {

    private final TheftDetectionService theftDetectionService;

    /**
     * Runs every day at 8:00 PM.
     * Sends stock verification reminder email to ALL registered admins.
     * Each admin's verification is handled separately when they submit stock.
     */
    @Scheduled(cron = "0 0 20 * * *")
    public void sendDailyStockVerificationReminder() {
        log.info("Triggering daily stock verification reminder at 8:00 PM...");
        theftDetectionService.sendDailyReminder();
        log.info("Daily stock verification reminders sent to all admins.");
    }
}
