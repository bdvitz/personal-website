package com.bdvitz.codingstats.service;

import com.bdvitz.codingstats.model.ChessDailyRating;
import com.bdvitz.codingstats.repository.ChessDailyRatingRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
public class ChessHistoryService {

    private static final Logger logger = LoggerFactory.getLogger(ChessHistoryService.class);
    private static final ZoneId UTC = ZoneOffset.UTC;

    private final ChessComApiService chessComApiService;
    private final ChessDailyRatingRepository dailyRatingRepository;

    public ChessHistoryService(ChessComApiService chessComApiService, ChessDailyRatingRepository dailyRatingRepository) {
        this.chessComApiService = chessComApiService;
        this.dailyRatingRepository = dailyRatingRepository;
    }

    /**
     * Get rating history for a month, retrieving from repository if user exists in database
     * Otherwise fetch from Chess.com API (guest user)
     * @param username Chess.com username
     * @param year Year (e.g., 2023)
     * @param month Month (1-12)
     * @return List of daily ratings for the month
     */
    public List<ChessDailyRating> getMonthHistory(String username, int year, int month) {
        logger.info("Getting history for user: {} for {}/{}", username, year, month);

        // Check if user exists in database (has any historical data)
        boolean userExists = dailyRatingRepository.existsByUsername(username);

        if (userExists) {
            // User exists in database, return data from DB (even if empty for this month)
            LocalDate startDate = LocalDate.of(year, month, 1);
            LocalDate endDate = startDate.plusMonths(1).minusDays(1);
            List<ChessDailyRating> existingHistory = dailyRatingRepository.findByUsernameAndDateBetween(username, startDate, endDate);
            logger.info("Found {} existing records in database for {}/{}", existingHistory.size(), year, month);
            return existingHistory;
        }

        // User does not exist in database, fetch from API (guest user)
        logger.info("User not found in database, fetching from API as guest");
        return fetchMonthHistory(username, year, month);
    }

    /**
     * Fetch rating history for a month from Chess.com API without storing in database
     * @param username Chess.com username
     * @param year Year (e.g., 2023)
     * @param month Month (1-12)
     * @return List of daily ratings for the month
     */
    public List<ChessDailyRating> fetchMonthHistory(String username, int year, int month) {
        logger.info("Fetching history from Chess.com API for user: {} for {}/{}", username, year, month);

        List<ChessDailyRating> dailyRatings = new ArrayList<>();

        try {
            JsonNode monthData = chessComApiService.fetchMonthlyGames(username, year, month);

            if (monthData != null) {
                processMonthlyGames(username, monthData, dailyRatings);
                logger.info("Processed {}/{}: {} daily ratings generated", year, month, dailyRatings.size());
            } else {
                logger.info("No games found for {}/{}", year, month);
            }
        } catch (Exception e) {
            logger.error("Error fetching month {}/{}: {}", year, month, e.getMessage());
        }

        return dailyRatings;
    }

    /**
     * Fetch rating history for a month from Chess.com API and save to database
     * @param username Chess.com username
     * @param year Year (e.g., 2023)
     * @param month Month (1-12)
     * @return List of daily ratings that were saved
     */
    @Transactional
    public List<ChessDailyRating> fetchAndUpdateMonthHistory(String username, int year, int month) {
        logger.info("Fetching and updating history for user: {} for {}/{}", username, year, month);

        List<ChessDailyRating> dailyRatings = fetchMonthHistory(username, year, month);

        // Save to database
        for (ChessDailyRating rating : dailyRatings) {
            Optional<ChessDailyRating> existingOpt = dailyRatingRepository.findByUsernameAndDate(username, rating.getDate());

            if (existingOpt.isPresent()) {
                ChessDailyRating existing = existingOpt.get();
                if (rating.getRapidRating() != null) existing.setRapidRating(rating.getRapidRating());
                if (rating.getBlitzRating() != null) existing.setBlitzRating(rating.getBlitzRating());
                if (rating.getBulletRating() != null) existing.setBulletRating(rating.getBulletRating());
                dailyRatingRepository.save(existing);
            } else {
                dailyRatingRepository.save(rating);
            }
        }

        logger.info("Saved {} daily ratings to database for {}/{}", dailyRatings.size(), year, month);
        return dailyRatings;
    }

    /**
     * Process games from a single month into a List of ChessDailyRating objects
     * Memory-efficient approach - processes games in chronological order
     */
    private void processMonthlyGames(String username, JsonNode monthData, List<ChessDailyRating> dailyRatings) {
        JsonNode gamesArray = monthData.path("games");

        if (gamesArray.isMissingNode() || !gamesArray.isArray()) {
            return;
        }

        ChessDailyRating currentDayRating = null;
        LocalDate currentDate = null;

        for (JsonNode game : gamesArray) {
            try {
                // Filter: only process "chess" rules (not chess960, etc.)
                String rules = game.path("rules").asText("");
                if (!"chess".equals(rules)) {
                    continue;
                }

                // Filter: only process rated games
                boolean isRated = game.path("rated").asBoolean(false);
                if (!isRated) {
                    continue;
                }

                // Extract game date from end_time (Unix timestamp)
                long endTime = game.path("end_time").asLong(0);
                if (endTime == 0) {
                    continue;
                }

                LocalDate gameDate = Instant.ofEpochSecond(endTime)
                        .atZone(UTC)
                        .toLocalDate();

                // Check if we're on a new day
                if (currentDate == null || !currentDate.equals(gameDate)) {
                    // Save previous day's rating if it exists
                    if (currentDayRating != null) {
                        dailyRatings.add(currentDayRating);
                    }

                    // Start new day
                    currentDate = gameDate;
                    currentDayRating = new ChessDailyRating(username, gameDate);
                }

                // Extract time_class (blitz, rapid, bullet)
                String timeClass = game.path("time_class").asText("");

                // Extract player rating based on username match
                Integer rating = extractPlayerRating(game, username);

                if (rating != null && !timeClass.isEmpty() && currentDayRating != null) {
                    // Update the rating for this game type (keeps the last rating of the day)
                    switch (timeClass) {
                        case "blitz":
                            currentDayRating.setBlitzRating(rating);
                            break;
                        case "rapid":
                            currentDayRating.setRapidRating(rating);
                            break;
                        case "bullet":
                            currentDayRating.setBulletRating(rating);
                            break;
                    }
                }

            } catch (Exception e) {
                logger.warn("Error processing individual game: {}", e.getMessage());
            }
        }

        // Don't forget the last day
        if (currentDayRating != null) {
            dailyRatings.add(currentDayRating);
        }
    }

    /**
     * Extract the player's rating from a game
     */
    private Integer extractPlayerRating(JsonNode game, String username) {
        // Check white player
        JsonNode whitePlayer = game.path("white");
        String whiteUsername = whitePlayer.path("username").asText("");
        if (whiteUsername.equalsIgnoreCase(username)) {
            return whitePlayer.path("rating").asInt(0);
        }

        // Check black player
        JsonNode blackPlayer = game.path("black");
        String blackUsername = blackPlayer.path("username").asText("");
        if (blackUsername.equalsIgnoreCase(username)) {
            return blackPlayer.path("rating").asInt(0);
        }

        return null;
    }
}
