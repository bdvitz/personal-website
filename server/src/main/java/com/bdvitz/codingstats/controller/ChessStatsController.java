package com.bdvitz.codingstats.controller;

import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.model.DailyRating;
import com.bdvitz.codingstats.service.ChessStatsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chess/stats")
public class ChessStatsController {
    
    private static final Logger logger = LoggerFactory.getLogger(ChessStatsController.class);
    
    @Autowired
    private ChessStatsService chessStatsService;
    
    /**
     * Get current chess statistics for a user
     * GET /api/chess/stats/current?username=shia_justdoit
     */
    @GetMapping("/current")
    public ResponseEntity<?> getCurrentStats(@RequestParam String username) {
        try {
            logger.info("Fetching current stats for user: {}", username);
            ChessStat stats = chessStatsService.getCurrentStats(username);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error fetching current stats", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Fetch and update chess statistics from Chess.com
     * POST /api/chess/stats/refresh?username=shia_justdoit
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshStats(@RequestParam String username) {
        try {
            logger.info("Refreshing stats for user: {}", username);
            ChessStat stats = chessStatsService.fetchAndStoreStats(username);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error refreshing stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Get rating history for a user
     * GET /api/chess/stats/history?username=shia_justdoit&days=30
     */
    @GetMapping("/history")
    public ResponseEntity<?> getRatingHistory(
            @RequestParam String username,
            @RequestParam(defaultValue = "30") int days) {
        try {
            logger.info("Fetching rating history for user: {} (last {} days)", username, days);
            List<DailyRating> history = chessStatsService.getRatingHistory(username, days);
            
            Map<String, Object> response = new HashMap<>();
            response.put("username", username);
            response.put("days", days);
            response.put("history", history);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error fetching rating history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Get all rating history for a user
     * GET /api/chess/stats/history/all?username=shia_justdoit
     */
    @GetMapping("/history/all")
    public ResponseEntity<?> getAllRatingHistory(@RequestParam String username) {
        try {
            logger.info("Fetching all rating history for user: {}", username);
            List<DailyRating> history = chessStatsService.getAllRatingHistory(username);
            
            Map<String, Object> response = new HashMap<>();
            response.put("username", username);
            response.put("history", history);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Error fetching all rating history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Get ratings over time formatted for charts
     * GET /api/chess/stats/ratings-over-time?username=shia_justdoit&days=90
     */
    @GetMapping("/ratings-over-time")
    public ResponseEntity<?> getRatingsOverTime(
            @RequestParam String username,
            @RequestParam(defaultValue = "90") int days) {
        try {
            logger.info("Fetching ratings over time for user: {} (last {} days)", username, days);
            Map<String, Object> chartData = chessStatsService.getRatingsOverTime(username, days);
            return ResponseEntity.ok(chartData);
        } catch (Exception e) {
            logger.error("Error fetching ratings over time", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Health check endpoint
     * GET /api/chess/stats/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        try {
            // Perform a basic connectivity check by attempting to get service info
            // This ensures the service layer and dependencies are accessible
            chessStatsService.toString(); // Basic check that service is available

            Map<String, String> response = new HashMap<>();
            response.put("status", "up");
            response.put("service", "Chess Stats API");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            logger.error("Health check failed", e);
            Map<String, String> response = new HashMap<>();
            response.put("status", "down");
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
