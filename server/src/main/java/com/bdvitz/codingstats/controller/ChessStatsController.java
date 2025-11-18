package com.bdvitz.codingstats.controller;

import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.model.DailyRating;
import com.bdvitz.codingstats.service.ChessStatsService;
import com.bdvitz.codingstats.service.GameHistoryService;
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

    @Autowired
    private GameHistoryService gameHistoryService;
    
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
     * Fetch and update current chess statistics from Chess.com
     * Does NOT update daily_ratings table (only updates chess_stats table)
     * POST /api/chess/stats/refresh?username=shia_justdoit
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshStats(@RequestParam String username) {
        try {
            logger.info("Refreshing current stats for user: {}", username);
            ChessStat stats = chessStatsService.fetchAndUpdateCurrentStats(username);
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
     * Get ratings by custom date range formatted for charts
     * GET /api/chess/stats/ratings-by-date-range?username=shia_justdoit&startDate=2023-01-01&endDate=2023-12-31
     */
    @GetMapping("/ratings-by-date-range")
    public ResponseEntity<?> getRatingsByDateRange(
            @RequestParam String username,
            @RequestParam String startDate,
            @RequestParam String endDate) {
        try {
            logger.info("Fetching ratings by date range for user: {} from {} to {}", username, startDate, endDate);

            java.time.LocalDate start = java.time.LocalDate.parse(startDate);
            java.time.LocalDate end = java.time.LocalDate.parse(endDate);

            Map<String, Object> chartData = chessStatsService.getRatingsByDateRange(username, start, end);
            return ResponseEntity.ok(chartData);
        } catch (Exception e) {
            logger.error("Error fetching ratings by date range", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Import historical game data from Chess.com
     * POST /api/chess/stats/import-history?username=shia_justdoit&startYear=2020&startMonth=1&endYear=2025&endMonth=11
     */
    @PostMapping("/import-history")
    public ResponseEntity<?> importHistoricalData(
            @RequestParam String username,
            @RequestParam(defaultValue = "2020") int startYear,
            @RequestParam(defaultValue = "1") int startMonth,
            @RequestParam(required = false) Integer endYear,
            @RequestParam(required = false) Integer endMonth) {
        try {
            logger.info("Starting historical data import for user: {} from {}/{} to {}/{}",
                    username, startYear, startMonth, endYear, endMonth);

            Map<String, Object> result = gameHistoryService.importHistoricalData(
                    username, startYear, startMonth, endYear, endMonth);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error importing historical data", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "status", "failed"));
        }
    }

    /**
     * Fetch current stats for guest user without storing in database
     * GET /api/chess/stats/guest-current?username=example
     */
    @GetMapping("/guest-current")
    public ResponseEntity<?> fetchGuestCurrentStats(@RequestParam String username) {
        try {
            logger.info("Fetching live stats for guest user: {}", username);
            Map<String, Object> stats = chessStatsService.fetchLiveStats(username);
            return ResponseEntity.ok(stats);
        } catch (Exception e) {
            logger.error("Error fetching guest current stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Fetch guest user historical data without storing in database
     * GET /api/chess/stats/guest-history?username=example&startYear=2020&startMonth=1&endYear=2025&endMonth=11
     */
    @GetMapping("/guest-history")
    public ResponseEntity<?> fetchGuestHistory(
            @RequestParam String username,
            @RequestParam(defaultValue = "2020") int startYear,
            @RequestParam(defaultValue = "1") int startMonth,
            @RequestParam(required = false) Integer endYear,
            @RequestParam(required = false) Integer endMonth) {
        try {
            logger.info("Fetching guest history for user: {} from {}/{} to {}/{}",
                    username, startYear, startMonth, endYear, endMonth);

            Map<String, Object> result = gameHistoryService.fetchGuestUserHistory(
                    username, startYear, startMonth, endYear, endMonth);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            logger.error("Error fetching guest history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage(), "status", "failed"));
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
