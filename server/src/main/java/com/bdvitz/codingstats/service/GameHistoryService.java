package com.bdvitz.codingstats.service;

import com.bdvitz.codingstats.model.DailyRating;
import com.bdvitz.codingstats.repository.DailyRatingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;

@Service
public class GameHistoryService {

    private static final Logger logger = LoggerFactory.getLogger(GameHistoryService.class);

    private final ChessComApiService chessComApiService;
    private final DailyRatingRepository dailyRatingRepository;

    public GameHistoryService(ChessComApiService chessComApiService, DailyRatingRepository dailyRatingRepository) {
        this.chessComApiService = chessComApiService;
        this.dailyRatingRepository = dailyRatingRepository;
    }

    /**
     * Import historical game data from Chess.com for a date range
     * @param username Chess.com username
     * @param startYear Starting year
     * @param startMonth Starting month
     * @param endYear Ending year (null = current year)
     * @param endMonth Ending month (null = current month)
     * @return Map with statistics about the import
     */
    @Transactional
    public Map<String, Object> importHistoricalData(String username, int startYear, int startMonth, Integer endYear, Integer endMonth) {
        logger.info("Starting historical data import for user: {} from {}/{} to {}/{}",
                username, startYear, startMonth, endYear, endMonth);

        LocalDate now = LocalDate.now();
        int currentYear = endYear != null ? endYear : now.getYear();
        int currentMonth = endMonth != null ? endMonth : now.getMonthValue();

        int totalMonthsProcessed = 0;
        int totalGamesProcessed = 0;
        int totalRatingsRecorded = 0;

        // Iterate through each month from start date to current month
        for (int year = startYear; year <= currentYear; year++) {
            int monthStart = (year == startYear) ? startMonth : 1;
            int monthEnd = (year == currentYear) ? currentMonth : 12;

            for (int month = monthStart; month <= monthEnd; month++) {
                try {
                    // Add a small delay to be respectful to Chess.com API
                    if (totalMonthsProcessed > 0) {
                        Thread.sleep(300); // 300ms delay between requests
                    }

                    JsonNode monthData = chessComApiService.fetchMonthlyGames(username, year, month);

                    if (monthData != null) {
                        int gamesProcessed = processMonthlyGames(username, monthData);
                        totalGamesProcessed += gamesProcessed;
                        totalMonthsProcessed++;

                        logger.info("Processed {}/{}: {} games", year, month, gamesProcessed);
                    }
                } catch (InterruptedException e) {
                    logger.error("Import interrupted", e);
                    Thread.currentThread().interrupt();
                    break;
                } catch (Exception e) {
                    logger.error("Error processing {}/{}: {}", year, month, e.getMessage());
                    // Continue with next month even if one fails
                }
            }
        }

        // Count total ratings recorded
        totalRatingsRecorded = dailyRatingRepository.findByUsernameOrderByDateAsc(username).size();

        Map<String, Object> result = new HashMap<>();
        result.put("monthsProcessed", totalMonthsProcessed);
        result.put("gamesProcessed", totalGamesProcessed);
        result.put("ratingsRecorded", totalRatingsRecorded);
        result.put("status", "completed");

        logger.info("Import completed. Months: {}, Games: {}, Ratings: {}",
                totalMonthsProcessed, totalGamesProcessed, totalRatingsRecorded);

        return result;
    }

    /**
     * Process games from a single month and extract ratings by date
     * @param username Chess.com username (case-insensitive match)
     * @param monthData JsonNode containing games array
     * @return Number of games processed
     */
    private int processMonthlyGames(String username, JsonNode monthData) {
        JsonNode gamesArray = monthData.path("games");

        if (gamesArray.isMissingNode() || !gamesArray.isArray()) {
            return 0;
        }

        // Track the last rating seen for each game type on each date
        Map<LocalDate, DailyRatingData> dailyRatingsMap = new HashMap<>();

        int gamesProcessed = 0;

        for (JsonNode game : gamesArray) {
            try {
                // Filter: only process "chess" rules (not chess960, etc.)
                String rules = game.path("rules").asText("");
                if (!"chess".equals(rules)) {
                    continue;
                }

                // Extract game date from end_time (Unix timestamp)
                long endTime = game.path("end_time").asLong(0);
                if (endTime == 0) {
                    continue;
                }

                LocalDate gameDate = Instant.ofEpochSecond(endTime)
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate();

                // Extract time_class (blitz, rapid, bullet)
                String timeClass = game.path("time_class").asText("");

                // Extract player rating based on username match
                Integer rating = extractPlayerRating(game, username);

                if (rating != null && !timeClass.isEmpty()) {
                    // Get or create daily rating data for this date
                    DailyRatingData dailyData = dailyRatingsMap.computeIfAbsent(
                            gameDate, k -> new DailyRatingData());

                    // Update the rating for this game type (keeps the last rating of the day)
                    switch (timeClass) {
                        case "blitz":
                            dailyData.blitzRating = rating;
                            break;
                        case "rapid":
                            dailyData.rapidRating = rating;
                            break;
                        case "bullet":
                            dailyData.bulletRating = rating;
                            break;
                    }

                    gamesProcessed++;
                }

            } catch (Exception e) {
                logger.warn("Error processing individual game: {}", e.getMessage());
            }
        }

        // Save or update daily ratings in database
        saveDailyRatings(username, dailyRatingsMap);

        return gamesProcessed;
    }

    /**
     * Extract the player's rating from a game
     * @param game JsonNode representing a single game
     * @param username Player's username (case-insensitive)
     * @return Rating or null if not found
     */
    private Integer extractPlayerRating(JsonNode game, String username) {
        JsonNode whitePlayer = game.path("white");
        JsonNode blackPlayer = game.path("black");

        // Check white player
        String whiteUsername = whitePlayer.path("username").asText("");
        if (whiteUsername.equalsIgnoreCase(username)) {
            return whitePlayer.path("rating").asInt(0);
        }

        // Check black player
        String blackUsername = blackPlayer.path("username").asText("");
        if (blackUsername.equalsIgnoreCase(username)) {
            return blackPlayer.path("rating").asInt(0);
        }

        return null;
    }

    /**
     * Save or update daily ratings in the database
     */
    private void saveDailyRatings(String username, Map<LocalDate, DailyRatingData> dailyRatingsMap) {
        for (Map.Entry<LocalDate, DailyRatingData> entry : dailyRatingsMap.entrySet()) {
            LocalDate date = entry.getKey();
            DailyRatingData data = entry.getValue();

            // Check if a rating already exists for this date
            Optional<DailyRating> existingOpt = dailyRatingRepository.findByUsernameAndDate(username, date);

            DailyRating dailyRating;
            if (existingOpt.isPresent()) {
                dailyRating = existingOpt.get();
            } else {
                dailyRating = new DailyRating(username, date);
            }

            // Update ratings (only if we found them in the games)
            if (data.blitzRating != null) {
                dailyRating.setBlitzRating(data.blitzRating);
            }
            if (data.rapidRating != null) {
                dailyRating.setRapidRating(data.rapidRating);
            }
            if (data.bulletRating != null) {
                dailyRating.setBulletRating(data.bulletRating);
            }

            dailyRatingRepository.save(dailyRating);
        }
    }

    /**
     * Helper class to track ratings for a single day
     */
    private static class DailyRatingData {
        Integer blitzRating;
        Integer rapidRating;
        Integer bulletRating;
    }
}
