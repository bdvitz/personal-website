package com.bdvitz.codingstats.controller;

import com.bdvitz.codingstats.model.ChessDailyRating;
import com.bdvitz.codingstats.service.ChessHistoryService;
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

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chess/history")
public class ChessHistoryController {

    private static final Logger logger = LoggerFactory.getLogger(ChessHistoryController.class);

    @Autowired
    private ChessHistoryService chessHistoryService;

    /**
     * Get rating history for a month (checks database first, falls back to API)
     * GET /api/chess/history/month?username=chess.username&year=2023&month=5
     */
    @GetMapping("/month")
    public ResponseEntity<?> getMonthHistory(
            @RequestParam String username,
            @RequestParam int year,
            @RequestParam int month) {
        try {
            if (month < 1 || month > 12) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Month must be between 1 and 12"));
            }

            logger.info("Getting history for user: {} for {}/{}", username, year, month);
            List<ChessDailyRating> history = chessHistoryService.getMonthHistory(username, year, month);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            logger.error("Error getting month history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Fetch and update rating history for a month from Chess.com API
     * POST /api/chess/history/refresh?username=chess.username&year=2023&month=5
     */
    @PostMapping("/refresh")
    public ResponseEntity<?> refreshMonthHistory(
            @RequestParam String username,
            @RequestParam int year,
            @RequestParam int month) {
        try {
            if (month < 1 || month > 12) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Month must be between 1 and 12"));
            }

            logger.info("Refreshing history for user: {} for {}/{}", username, year, month);
            List<ChessDailyRating> history = chessHistoryService.fetchAndUpdateMonthHistory(username, year, month);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            logger.error("Error refreshing month history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Fetch month history for guest user without storing in database
     * GET /api/chess/history/guest-month?username=example&year=2023&month=5
     */
    @GetMapping("/guest-month")
    public ResponseEntity<?> fetchGuestMonthHistory(
            @RequestParam String username,
            @RequestParam int year,
            @RequestParam int month) {
        try {
            if (month < 1 || month > 12) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body(Map.of("error", "Month must be between 1 and 12"));
            }

            logger.info("Fetching guest history for user: {} for {}/{}", username, year, month);
            List<ChessDailyRating> history = chessHistoryService.fetchMonthHistory(username, year, month);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            logger.error("Error fetching guest month history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Get rating history for current month (defaults to current year/month)
     * GET /api/chess/history/current?username=chess.username
     */
    @GetMapping("/current")
    public ResponseEntity<?> getCurrentMonthHistory(@RequestParam String username) {
        try {
            LocalDate now = LocalDate.now(ZoneOffset.UTC);
            int year = now.getYear();
            int month = now.getMonthValue();

            logger.info("Getting current month history for user: {} ({}/{})", username, year, month);
            List<ChessDailyRating> history = chessHistoryService.getMonthHistory(username, year, month);
            return ResponseEntity.ok(history);
        } catch (Exception e) {
            logger.error("Error getting current month history", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * Health check endpoint
     * GET /api/chess/history/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> healthCheck() {
        try {
            chessHistoryService.toString();

            Map<String, String> response = new HashMap<>();
            response.put("status", "up");
            response.put("service", "Chess History API");
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
