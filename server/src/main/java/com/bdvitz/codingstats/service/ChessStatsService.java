package com.bdvitz.codingstats.service;

import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.model.DailyRating;
import com.bdvitz.codingstats.repository.ChessStatRepository;
import com.bdvitz.codingstats.repository.DailyRatingRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ChessStatsService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChessStatsService.class);
    
    @Autowired
    private ChessStatRepository chessStatRepository;
    
    @Autowired
    private DailyRatingRepository dailyRatingRepository;
    
    @Autowired
    private ChessComApiService chessComApiService;
    
    /**
     * Get current chess statistics for a user
     */
    public ChessStat getCurrentStats(String username) {
        return chessStatRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("No stats found for user: " + username));
    }
    
    /**
     * Fetch and store chess statistics from Chess.com
     */
    @Transactional
    public ChessStat fetchAndStoreStats(String username) {
        logger.info("Fetching stats for user: {}", username);
        
        // Fetch stats from Chess.com API
        Map<String, Object> apiStats = chessComApiService.fetchChessStats(username);
        
        // Find or create ChessStat entity
        ChessStat chessStat = chessStatRepository.findByUsername(username)
                .orElse(new ChessStat(username));
        
        // Update stats
        chessStat.setRapidRating((Integer) apiStats.get("rapidRating"));
        chessStat.setBlitzRating((Integer) apiStats.get("blitzRating"));
        chessStat.setBulletRating((Integer) apiStats.get("bulletRating"));
        chessStat.setPuzzleRating((Integer) apiStats.get("puzzleRating"));
        chessStat.setTotalGames((Integer) apiStats.get("totalGames"));
        chessStat.setWins((Integer) apiStats.get("wins"));
        chessStat.setLosses((Integer) apiStats.get("losses"));
        chessStat.setDraws((Integer) apiStats.get("draws"));
        chessStat.setLastUpdated(LocalDateTime.now());
        
        // Save to database
        ChessStat saved = chessStatRepository.save(chessStat);
        
        // Also create daily rating snapshot
        saveDailyRating(username, saved);
        
        logger.info("Successfully updated stats for user: {}", username);
        return saved;
    }
    
    /**
     * Save daily rating snapshot
     */
    @Transactional
    public void saveDailyRating(String username, ChessStat chessStat) {
        LocalDate today = LocalDate.now();
        
        // Check if we already have a snapshot for today
        Optional<DailyRating> existingRating = dailyRatingRepository.findByUsernameAndDate(username, today);
        
        DailyRating dailyRating;
        if (existingRating.isPresent()) {
            dailyRating = existingRating.get();
            logger.info("Updating existing daily rating for user: {} on date: {}", username, today);
        } else {
            dailyRating = new DailyRating(username, today);
            logger.info("Creating new daily rating for user: {} on date: {}", username, today);
        }
        
        dailyRating.setRapidRating(chessStat.getRapidRating());
        dailyRating.setBlitzRating(chessStat.getBlitzRating());
        dailyRating.setBulletRating(chessStat.getBulletRating());
        dailyRating.setPuzzleRating(chessStat.getPuzzleRating());
        
        dailyRatingRepository.save(dailyRating);
    }
    
    /**
     * Get rating history for a user
     */
    public List<DailyRating> getRatingHistory(String username, int days) {
        LocalDate startDate = LocalDate.now().minusDays(days);
        return dailyRatingRepository.findByUsernameAndDateAfter(username, startDate);
    }
    
    /**
     * Get all rating history for a user
     */
    public List<DailyRating> getAllRatingHistory(String username) {
        return dailyRatingRepository.findByUsernameOrderByDateAsc(username);
    }
    
    /**
     * Get formatted data for charts
     */
    public Map<String, Object> getRatingsOverTime(String username, int days) {
        List<DailyRating> history = getRatingHistory(username, days);
        return formatChartData(history);
    }

    /**
     * Get formatted data for charts by date range
     */
    public Map<String, Object> getRatingsByDateRange(String username, LocalDate startDate, LocalDate endDate) {
        List<DailyRating> history = dailyRatingRepository.findByUsernameAndDateBetween(username, startDate, endDate);
        return formatChartData(history);
    }

    /**
     * Format rating history into chart data with proper date spacing
     * Fills in missing dates with null values to show gaps in the chart
     */
    private Map<String, Object> formatChartData(List<DailyRating> history) {
        Map<String, Object> chartData = new HashMap<>();

        if (history.isEmpty()) {
            chartData.put("labels", new ArrayList<>());
            chartData.put("datasets", new ArrayList<>());
            return chartData;
        }

        // Find the date range
        LocalDate startDate = history.get(0).getDate();
        LocalDate endDate = history.get(history.size() - 1).getDate();

        // Create a map for quick lookup of ratings by date
        Map<LocalDate, DailyRating> ratingsByDate = history.stream()
                .collect(Collectors.toMap(DailyRating::getDate, rating -> rating));

        // Generate all dates in the range
        List<String> labels = new ArrayList<>();
        List<Integer> rapidRatings = new ArrayList<>();
        List<Integer> blitzRatings = new ArrayList<>();
        List<Integer> bulletRatings = new ArrayList<>();
        List<Integer> puzzleRatings = new ArrayList<>();

        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate)) {
            labels.add(currentDate.toString());

            DailyRating rating = ratingsByDate.get(currentDate);
            if (rating != null) {
                rapidRatings.add(rating.getRapidRating());
                blitzRatings.add(rating.getBlitzRating());
                bulletRatings.add(rating.getBulletRating());
                puzzleRatings.add(rating.getPuzzleRating());
            } else {
                // Add null for dates with no data (creates gaps in the chart)
                rapidRatings.add(null);
                blitzRatings.add(null);
                bulletRatings.add(null);
                puzzleRatings.add(null);
            }

            currentDate = currentDate.plusDays(1);
        }

        // Create datasets
        List<Map<String, Object>> datasets = new ArrayList<>();
        datasets.add(createDataset("Rapid", rapidRatings, "#22c55e"));
        datasets.add(createDataset("Blitz", blitzRatings, "#3b82f6"));
        datasets.add(createDataset("Bullet", bulletRatings, "#ef4444"));
        datasets.add(createDataset("Puzzle", puzzleRatings, "#a855f7"));

        chartData.put("labels", labels);
        chartData.put("datasets", datasets);

        return chartData;
    }
    
    /**
     * Helper method to create dataset for charts
     */
    private Map<String, Object> createDataset(String label, List<Integer> data, String color) {
        Map<String, Object> dataset = new HashMap<>();
        dataset.put("label", label);
        dataset.put("data", data);
        dataset.put("borderColor", color);
        dataset.put("backgroundColor", color + "33"); // Add transparency
        return dataset;
    }
    
    /**
     * Check if user has stats in database
     */
    public boolean hasStats(String username) {
        return chessStatRepository.existsByUsername(username);
    }
}
