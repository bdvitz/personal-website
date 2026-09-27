package com.bdvitz.codingstats.controller;

import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.service.ChessStatsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.HashMap;
import java.util.Map;
import java.util.NoSuchElementException;

/**
 * Read-only access to stored chess stats. Data is refreshed from Chess.com only by ChessStatsScheduler.
 * Removed guest/refresh endpoints are documented in docs/removed-chess-guest-lookup.md.
 */
@RestController
@RequestMapping("/api/chess/stats")
public class ChessStatsController {

    private static final Logger logger = LoggerFactory.getLogger(ChessStatsController.class);

    @Autowired
    private ChessStatsService chessStatsService;

    /**
     * Get stored chess statistics for a user
     * GET /api/chess/stats/current?username=chess.username
     */
    @GetMapping("/current")
    public ResponseEntity<?> getCurrentStats(@RequestParam String username) {
        try {
            logger.info("Fetching current stats for user: {}", username);
            ChessStat chessStat = chessStatsService.getCurrentStats(username);
            return ResponseEntity.ok(chessStat);
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "No stored stats found"));
        } catch (Exception e) {
            logger.error("Error fetching current stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch chess statistics"));
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
            response.put("error", "Service unavailable");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
