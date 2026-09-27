package com.bdvitz.codingstats.scheduler;

import com.bdvitz.codingstats.service.ChessHistoryService;
import com.bdvitz.codingstats.service.ChessStatsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Lazy;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Keeps the stored user's data fresh: current stats (chess_stats) and daily rating history (daily_ratings).
 *
 * @Lazy(false) is required: application.properties enables global lazy initialization, and nothing injects
 * this bean, so without it the bean is never created and the @Scheduled method is never registered.
 */
@Component
@Lazy(false)
public class ChessStatsScheduler {

    private static final Logger logger = LoggerFactory.getLogger(ChessStatsScheduler.class);

    private final ChessStatsService chessStatsService;
    private final ChessHistoryService chessHistoryService;

    @Value("${chess.username}")
    private String chessUsername;

    public ChessStatsScheduler(ChessStatsService chessStatsService, ChessHistoryService chessHistoryService) {
        this.chessStatsService = chessStatsService;
        this.chessHistoryService = chessHistoryService;
    }

    /**
     * Daily at 03:00 UTC.
     */
    @Scheduled(cron = "0 0 3 * * *", zone = "UTC")
    public void fetchChessStatsScheduled() {
        updateAll("scheduled");
    }

    /**
     * Catch up on startup. Railway may restart or sleep the service and miss the 3 AM run;
     * history sync is incremental, so this is cheap when data is already current.
     */
    @EventListener(ApplicationReadyEvent.class)
    public void fetchChessStatsOnStartup() {
        updateAll("startup");
    }

    private void updateAll(String trigger) {
        logger.info("Starting {} chess update for user: {}", trigger, chessUsername);

        try {
            chessStatsService.fetchAndUpdateCurrentStats(chessUsername);
            logger.info("Current stats updated");
        } catch (Exception e) {
            logger.error("Error updating current stats", e);
        }

        try {
            int saved = chessHistoryService.syncHistorySinceLastStored(chessUsername);
            logger.info("Rating history synced ({} daily ratings saved)", saved);
        } catch (Exception e) {
            logger.error("Error syncing rating history", e);
        }
    }
}
