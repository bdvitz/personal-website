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

        // Fetch available archives first
        Set<String> validArchives = getValidArchivesInRange(username, startYear, startMonth, currentYear, currentMonth);

        if (validArchives.isEmpty()) {
            logger.warn("No valid archives found for user {} in the specified range", username);
            Map<String, Object> result = new HashMap<>();
            result.put("monthsProcessed", 0);
            result.put("gamesProcessed", 0);
            result.put("ratingsRecorded", 0);
            result.put("status", "no_data");
            return result;
        }

        logger.info("Found {} valid archive months to process", validArchives.size());

        // Process only the valid archives
        for (String archive : validArchives) {
            try {
                // Parse year/month from archive URL
                // Format: https://api.chess.com/pub/player/{username}/games/YYYY/MM
                String[] parts = archive.split("/");
                int year = Integer.parseInt(parts[parts.length - 2]);
                int month = Integer.parseInt(parts[parts.length - 1]);

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
                logger.error("Error processing archive {}: {}", archive, e.getMessage());
                // Continue with next month even if one fails
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
     * Get valid archives from Chess.com API that fall within the specified date range
     * @param username Chess.com username
     * @param startYear Starting year
     * @param startMonth Starting month (1-12)
     * @param endYear Ending year
     * @param endMonth Ending month (1-12)
     * @return Set of archive URLs that are within the date range
     */
    private Set<String> getValidArchivesInRange(String username, int startYear, int startMonth, int endYear, int endMonth) {
        Set<String> validArchives = new LinkedHashSet<>();

        try {
            JsonNode archivesData = chessComApiService.fetchAvailableArchives(username);

            if (archivesData == null || archivesData.path("archives").isMissingNode()) {
                return validArchives;
            }

            JsonNode archivesArray = archivesData.path("archives");

            for (JsonNode archive : archivesArray) {
                String archiveUrl = archive.asText();

                // Parse year/month from URL
                // Format: https://api.chess.com/pub/player/{username}/games/YYYY/MM
                String[] parts = archiveUrl.split("/");
                if (parts.length >= 2) {
                    try {
                        int year = Integer.parseInt(parts[parts.length - 2]);
                        int month = Integer.parseInt(parts[parts.length - 1]);

                        // Check if this archive is within our date range
                        if (isDateInRange(year, month, startYear, startMonth, endYear, endMonth)) {
                            validArchives.add(archiveUrl);
                        }
                    } catch (NumberFormatException e) {
                        logger.warn("Could not parse year/month from archive URL: {}", archiveUrl);
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Error fetching valid archives: {}", e.getMessage());
        }

        return validArchives;
    }

    /**
     * Check if a given year/month is within the specified date range
     */
    private boolean isDateInRange(int year, int month, int startYear, int startMonth, int endYear, int endMonth) {
        // Convert to comparable integers (YYYYMM format)
        int current = year * 100 + month;
        int start = startYear * 100 + startMonth;
        int end = endYear * 100 + endMonth;

        return current >= start && current <= end;
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
     * Fetch historical game data for a guest user without storing in database
     * @param username Chess.com username
     * @param startYear Starting year
     * @param startMonth Starting month
     * @param endYear Ending year (null = current year)
     * @param endMonth Ending month (null = current month)
     * @return Map with chart data and statistics
     */
    public Map<String, Object> fetchGuestUserHistory(String username, int startYear, int startMonth, Integer endYear, Integer endMonth) {
        logger.info("Fetching guest user history for: {} from {}/{} to {}/{}",
                username, startYear, startMonth, endYear, endMonth);

        LocalDate now = LocalDate.now();
        int currentYear = endYear != null ? endYear : now.getYear();
        int currentMonth = endMonth != null ? endMonth : now.getMonthValue();

        // Track ratings by date without saving to database
        Map<LocalDate, DailyRatingData> dailyRatingsMap = new TreeMap<>();
        int totalGamesProcessed = 0;

        // Fetch available archives first
        Set<String> validArchives = getValidArchivesInRange(username, startYear, startMonth, currentYear, currentMonth);

        if (validArchives.isEmpty()) {
            logger.warn("No valid archives found for guest user {} in the specified range", username);
            Map<String, Object> result = new HashMap<>();
            result.put("labels", new ArrayList<>());
            result.put("datasets", new ArrayList<>());
            result.put("gamesProcessed", 0);
            result.put("status", "no_data");
            return result;
        }

        logger.info("Found {} valid archive months to process for guest user", validArchives.size());

        // Process only the valid archives
        for (String archive : validArchives) {
            try {
                // Parse year/month from archive URL
                String[] parts = archive.split("/");
                int year = Integer.parseInt(parts[parts.length - 2]);
                int month = Integer.parseInt(parts[parts.length - 1]);

                // Add a small delay to be respectful to Chess.com API
                if (totalGamesProcessed > 0) {
                    Thread.sleep(300); // 300ms delay between requests
                }

                JsonNode monthData = chessComApiService.fetchMonthlyGames(username, year, month);

                if (monthData != null) {
                    int gamesProcessed = processMonthlyGamesForGuest(username, monthData, dailyRatingsMap);
                    totalGamesProcessed += gamesProcessed;
                    logger.info("Processed {}/{}: {} games for guest user", year, month, gamesProcessed);
                }
            } catch (InterruptedException e) {
                logger.error("Fetch interrupted", e);
                Thread.currentThread().interrupt();
                break;
            } catch (Exception e) {
                logger.error("Error processing archive {}: {}", archive, e.getMessage());
            }
        }

        // Format the data for chart display
        Map<String, Object> result = formatGuestChartData(dailyRatingsMap);
        result.put("gamesProcessed", totalGamesProcessed);
        result.put("status", "completed");

        logger.info("Guest user fetch completed. Games: {}", totalGamesProcessed);

        return result;
    }

    /**
     * Process games from a single month for guest users (no database storage)
     */
    private int processMonthlyGamesForGuest(String username, JsonNode monthData, Map<LocalDate, DailyRatingData> dailyRatingsMap) {
        JsonNode gamesArray = monthData.path("games");

        if (gamesArray.isMissingNode() || !gamesArray.isArray()) {
            return 0;
        }

        int gamesProcessed = 0;

        for (JsonNode game : gamesArray) {
            try {
                // Filter: only process "chess" rules
                String rules = game.path("rules").asText("");
                if (!"chess".equals(rules)) {
                    continue;
                }

                // Filter: only process rated games
                boolean isRated = game.path("rated").asBoolean(false);
                if (!isRated) {
                    continue;
                }

                // Extract game date from end_time
                long endTime = game.path("end_time").asLong(0);
                if (endTime == 0) {
                    continue;
                }

                LocalDate gameDate = Instant.ofEpochSecond(endTime)
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate();

                // Extract time_class
                String timeClass = game.path("time_class").asText("");

                // Extract player rating
                Integer rating = extractPlayerRating(game, username);

                if (rating != null && !timeClass.isEmpty()) {
                    DailyRatingData dailyData = dailyRatingsMap.computeIfAbsent(
                            gameDate, k -> new DailyRatingData());

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

        return gamesProcessed;
    }

    /**
     * Format guest user data for chart display
     */
    private Map<String, Object> formatGuestChartData(Map<LocalDate, DailyRatingData> dailyRatingsMap) {
        Map<String, Object> chartData = new HashMap<>();

        if (dailyRatingsMap.isEmpty()) {
            chartData.put("labels", new ArrayList<>());
            chartData.put("datasets", new ArrayList<>());
            return chartData;
        }

        // Get date range
        LocalDate startDate = dailyRatingsMap.keySet().iterator().next();
        LocalDate endDate = dailyRatingsMap.keySet().stream()
                .reduce((first, second) -> second).orElse(startDate);

        // Generate all dates in range
        List<String> labels = new ArrayList<>();
        List<Integer> rapidRatings = new ArrayList<>();
        List<Integer> blitzRatings = new ArrayList<>();
        List<Integer> bulletRatings = new ArrayList<>();

        LocalDate currentDate = startDate;
        while (!currentDate.isAfter(endDate)) {
            labels.add(currentDate.toString());

            DailyRatingData data = dailyRatingsMap.get(currentDate);
            if (data != null) {
                rapidRatings.add(data.rapidRating);
                blitzRatings.add(data.blitzRating);
                bulletRatings.add(data.bulletRating);
            } else {
                rapidRatings.add(null);
                blitzRatings.add(null);
                bulletRatings.add(null);
            }

            currentDate = currentDate.plusDays(1);
        }

        // Create datasets
        List<Map<String, Object>> datasets = new ArrayList<>();
        datasets.add(createDataset("Rapid", rapidRatings, "#22c55e"));
        datasets.add(createDataset("Blitz", blitzRatings, "#3b82f6"));
        datasets.add(createDataset("Bullet", bulletRatings, "#ef4444"));

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
        dataset.put("backgroundColor", color + "33");
        return dataset;
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
