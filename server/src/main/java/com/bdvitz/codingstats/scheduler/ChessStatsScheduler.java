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
    
    @Value("${chess.username:shia_justdoit}")
    private String chessUsername;
    
    /**
     * Scheduled task to fetch chess stats daily at midnight UTC
     * Cron expression: "0 0 0 * * *" = Every day at 00:00:00
     */
    @Scheduled(cron = "0 0 0 * * *")
    public void fetchDailyChessStats() {
        logger.info("Starting scheduled chess stats fetch for user: {}", chessUsername);
        
        try {
            chessStatsService.fetchAndStoreStats(chessUsername);
            logger.info("Successfully completed scheduled chess stats fetch");
        } catch (Exception e) {
            logger.error("Error during scheduled chess stats fetch", e);
        }
    }
    
    /**
     * Optional: Run every hour for more frequent updates during testing
     * Uncomment to use during development
     */
    // @Scheduled(cron = "0 0 * * * *")
    // public void fetchHourlyChessStats() {
    //     logger.info("Starting hourly chess stats fetch for user: {}", chessUsername);
    //     
    //     try {
    //         chessStatsService.fetchAndStoreStats(chessUsername);
    //         logger.info("Successfully completed hourly chess stats fetch");
    //     } catch (Exception e) {
    //         logger.error("Error during hourly chess stats fetch", e);
    //     }
    // }
}
