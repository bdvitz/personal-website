package com.bdvitz.codingstats.controller;

import com.bdvitz.codingstats.model.ChessDailyRating;
import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.repository.ChessDailyRatingRepository;
import com.bdvitz.codingstats.repository.ChessStatRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Controller to generate snapshot data for offline/cached use.
 * This allows the frontend to display data even when the server is sleeping.
 */
@RestController
@RequestMapping("/api/snapshot")
@CrossOrigin(origins = "${cors.allowed.origins}")
public class SnapshotController {

    private static final Logger logger = LoggerFactory.getLogger(SnapshotController.class);

    private final ChessStatRepository chessStatRepository;
    private final ChessDailyRatingRepository chessDailyRatingRepository;

    @Value("${chess.username}")
    private String chessUsername;

    public SnapshotController(
            ChessStatRepository chessStatRepository,
            ChessDailyRatingRepository chessDailyRatingRepository) {
        this.chessStatRepository = chessStatRepository;
        this.chessDailyRatingRepository = chessDailyRatingRepository;
    }

    /**
     * Generate snapshot data for the stored user.
     * This endpoint should be called manually or via a scheduled task to update the snapshot file.
     *
     * Returns:
     * {
     *   "currentStats": ChessStat object,
     *   "historicalData": List of ChessDailyRating objects (since June 9, 2020),
     *   "generatedAt": timestamp,
     *   "username": string
     * }
     */
    @GetMapping("/generate")
    public ResponseEntity<Map<String, Object>> generateSnapshot() {
        logger.info("Generating snapshot for stored user: {}", chessUsername);

        try {
            Map<String, Object> snapshot = new HashMap<>();

            // Get current stats
            ChessStat currentStats = chessStatRepository.findByUsername(chessUsername)
                    .orElse(null);

            // Get all historical data since June 9, 2020
            LocalDate startDate = LocalDate.of(2020, 6, 9);
            LocalDate endDate = LocalDate.now();
            List<ChessDailyRating> historicalData = chessDailyRatingRepository
                    .findByUsernameAndDateBetween(chessUsername, startDate, endDate);

            snapshot.put("currentStats", currentStats);
            snapshot.put("historicalData", historicalData);
            snapshot.put("generatedAt", System.currentTimeMillis());
            snapshot.put("username", chessUsername);

            logger.info("Snapshot generated successfully with {} historical records", historicalData.size());
            return ResponseEntity.ok(snapshot);

        } catch (Exception e) {
            logger.error("Error generating snapshot", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get snapshot for a specific date range.
     * Useful for updating the snapshot incrementally.
     */
    @GetMapping("/range")
    public ResponseEntity<Map<String, Object>> getSnapshotRange(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {

        logger.info("Generating snapshot range for user: {} from {} to {}", chessUsername, startDate, endDate);

        try {
            LocalDate start = startDate != null ? LocalDate.parse(startDate) : LocalDate.of(2020, 6, 9);
            LocalDate end = endDate != null ? LocalDate.parse(endDate) : LocalDate.now();

            List<ChessDailyRating> historicalData = chessDailyRatingRepository
                    .findByUsernameAndDateBetween(chessUsername, start, end);

            Map<String, Object> snapshot = new HashMap<>();
            snapshot.put("historicalData", historicalData);
            snapshot.put("startDate", start);
            snapshot.put("endDate", end);
            snapshot.put("count", historicalData.size());

            return ResponseEntity.ok(snapshot);

        } catch (Exception e) {
            logger.error("Error generating snapshot range", e);
            return ResponseEntity.badRequest().build();
        }
    }
}
