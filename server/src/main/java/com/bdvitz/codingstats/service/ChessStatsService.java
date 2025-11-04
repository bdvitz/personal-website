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
        
        Map<String, Object> chartData = new HashMap<>();
        
        // Extract dates as labels
        List<String> labels = history.stream()
                .map(rating -> rating.getDate().toString())
                .collect(Collectors.toList());
        
        // Extract rating data for each game mode
        List<Map<String, Object>> datasets = new ArrayList<>();
        
        // Rapid ratings
        datasets.add(createDataset("Rapid", history.stream()
                .map(DailyRating::getRapidRating)
                .collect(Collectors.toList()), "#22c55e"));
        
        // Blitz ratings
        datasets.add(createDataset("Blitz", history.stream()
                .map(DailyRating::getBlitzRating)
                .collect(Collectors.toList()), "#3b82f6"));
        
        // Bullet ratings
        datasets.add(createDataset("Bullet", history.stream()
                .map(DailyRating::getBulletRating)
                .collect(Collectors.toList()), "#ef4444"));
        
        // Puzzle ratings
        datasets.add(createDataset("Puzzle", history.stream()
                .map(DailyRating::getPuzzleRating)
                .collect(Collectors.toList()), "#a855f7"));
        
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
