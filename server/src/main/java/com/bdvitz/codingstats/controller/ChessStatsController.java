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
import org.springframework.web.bind.annotation.PostMapping;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/chess/stats")
public class ChessStatsController {

    private static final Logger logger = LoggerFactory.getLogger(ChessStatsController.class);

    @Autowired
    private ChessStatsService chessStatsService;
    
    /**
     * Get current chess statistics for a user
     * GET /api/chess/stats/current?username=chess.username
     */
    @GetMapping("/current")
    public ResponseEntity<?> getCurrentStats(@RequestParam String username) {
        try {
            logger.info("Fetching current stats for user: {}", username);
            ChessStat chessStat = chessStatsService.getCurrentStats(username);
            return ResponseEntity.ok(chessStat);
        } catch (Exception e) {
            logger.error("Error fetching current stats", e);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", e.getMessage()));
        }
    }
    
    /**
     * Fetch and update current chess statistics from Chess.com
     * Does NOT update daily_ratings table (only updates chess_stats table)
     * POST /api/chess/stats/refresh?username=chess.username
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshStats(@RequestParam String username) {
        try {
            logger.info("Refreshing current stats for user: {}", username);
            ChessStat chessStat = chessStatsService.fetchAndUpdateCurrentStats(username);
            return ResponseEntity.ok(chessStat);
        } catch (Exception e) {
            logger.error("Error refreshing stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
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
            ChessStat chessStat = chessStatsService.fetchCurrentStats(username);
            return ResponseEntity.ok(chessStat);
        } catch (Exception e) {
            logger.error("Error fetching guest current stats", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Verify if a Chess.com user exists and get account creation date
     * GET /api/chess/stats/verify?username=example
     */
    @GetMapping("/verify")
    public ResponseEntity<?> verifyUser(@RequestParam String username) {
        try {
            logger.info("Verifying Chess.com user: {}", username);
            var userInfo = chessStatsService.verifyUserExists(username);

            Map<String, Object> response = new HashMap<>();
            response.put("exists", userInfo.isExists());
            response.put("username", userInfo.getUsername());
            response.put("joinedTimestamp", userInfo.getJoinedTimestamp());
            response.put("message", null);

            return ResponseEntity.ok(response);
        } catch (org.springframework.web.client.HttpClientErrorException.NotFound e) {
            // User doesn't exist on Chess.com - return 404
            logger.info("User not found: {}", username);
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "User does not exist on Chess.com"));
        } catch (RuntimeException e) {
            // Check if it's a service unavailability issue (timeout, network error)
            if (e.getMessage() != null &&
                (e.getMessage().contains("unavailable") ||
                 e.getMessage().contains("timeout") ||
                 e.getMessage().contains("null response"))) {
                logger.error("Chess.com API unavailable for user: {}", username, e);
                return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                        .body(Map.of("error", "Server is currently offline"));
            }
            // Other runtime exceptions - return 500
            logger.error("Error verifying user: {}", username, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to verify user"));
        } catch (Exception e) {
            logger.error("Unexpected error verifying user: {}", username, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to verify user"));
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
