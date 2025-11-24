package com.bdvitz.codingstats.scheduler;

import com.bdvitz.codingstats.service.ChessStatsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class ChessStatsScheduler {
    
    private static final Logger logger = LoggerFactory.getLogger(ChessStatsScheduler.class);
    
    @Autowired
    private ChessStatsService chessStatsService;
    
    @Value("${chess.username}")
    private String chessUsername;
    
    /**
     * Scheduled task to fetch chess stats daily at 3 AM UTC
     * Cron expression: "0 0 3 * * *" = Every day at 03:00:00
     */
    @Scheduled(cron = "0 0 3 * * *")
    public void fetchChessStatsScheduled() {
        logger.info("Starting scheduled chess stats fetch for user: {}", chessUsername);
        try {
            chessStatsService.fetchAndUpdateCurrentStats(chessUsername);
            logger.info("Successfully completed scheduled chess stats update");
        } catch (Exception e) {
            logger.error("Error during scheduled chess stats update", e);
        }
    }
}
