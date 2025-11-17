package com.bdvitz.codingstats.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.http.HttpStatus;

import java.util.HashMap;
import java.util.Map;

@Service
public class ChessComApiService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChessComApiService.class);
    private static final String CHESS_COM_API_BASE = "https://api.chess.com/pub/player/";
    
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    public ChessComApiService() {
        this.restTemplate = new RestTemplate();
        this.objectMapper = new ObjectMapper();
    }
    
    /**
     * Fetch chess statistics from Chess.com API
     * @param username Chess.com username
     * @return Map containing rating statistics
     */
    public Map<String, Object> fetchChessStats(String username) {
        Map<String, Object> stats = new HashMap<>();
        
        try {
            // Fetch player stats
            String statsUrl = CHESS_COM_API_BASE + username + "/stats";
            String response = restTemplate.getForObject(statsUrl, String.class);
            
            if (response != null) {
                JsonNode rootNode = objectMapper.readTree(response);
                
                // Extract ratings from different game modes
                stats.put("rapidRating", extractRating(rootNode, "chess_rapid"));
                stats.put("blitzRating", extractRating(rootNode, "chess_blitz"));
                stats.put("bulletRating", extractRating(rootNode, "chess_bullet"));
                stats.put("puzzleRating", extractRating(rootNode, "tactics"));
                
                // Extract game statistics
                Map<String, Integer> gameStats = extractGameStats(rootNode);
                stats.putAll(gameStats);
                
                logger.info("Successfully fetched stats for user: {}", username);
            }
            
        } catch (HttpClientErrorException.NotFound e) {
            logger.error("User not found: {}", username);
            throw new RuntimeException("Chess.com user not found: " + username);
        } catch (Exception e) {
            logger.error("Error fetching chess stats for user: {}", username, e);
            throw new RuntimeException("Failed to fetch chess statistics: " + e.getMessage());
        }
        
        return stats;
    }
    
    /**
     * Extract rating from a specific game mode
     */
    private Integer extractRating(JsonNode rootNode, String gameMode) {
        try {
            JsonNode gameModeNode = rootNode.path(gameMode);
            if (!gameModeNode.isMissingNode()) {
                JsonNode lastNode = gameModeNode.path("last");
                if (!lastNode.isMissingNode()) {
                    return lastNode.path("rating").asInt(0);
                }
                lastNode = gameModeNode.path("highest");  // fallback to highest if last is not available
                if (!lastNode.isMissingNode()) {
                    return lastNode.path("rating").asInt(0);
                }
            }
        } catch (Exception e) {
            logger.warn("Could not extract rating for game mode: {}", gameMode);
        }
        return null;
    }
    
    /**
     * Extract win/loss/draw statistics across all game modes
     */
    private Map<String, Integer> extractGameStats(JsonNode rootNode) {
        Map<String, Integer> gameStats = new HashMap<>();
        int totalWins = 0;
        int totalLosses = 0;
        int totalDraws = 0;
        
        String[] gameModes = {"chess_rapid", "chess_blitz", "chess_bullet"};
        // String[] gameModes = {"chess_rapid", "chess_blitz", "chess_bullet", "chess_daily"};  // daily mode can be included if needed
        
        for (String mode : gameModes) {
            JsonNode modeNode = rootNode.path(mode);
            if (!modeNode.isMissingNode()) {
                JsonNode recordNode = modeNode.path("record");
                if (!recordNode.isMissingNode()) {
                    totalWins += recordNode.path("win").asInt(0);
                    totalLosses += recordNode.path("loss").asInt(0);
                    totalDraws += recordNode.path("draw").asInt(0);
                }
            }
        }
        
        int totalGames = totalWins + totalLosses + totalDraws;
        
        gameStats.put("wins", totalWins);
        gameStats.put("losses", totalLosses);
        gameStats.put("draws", totalDraws);
        gameStats.put("totalGames", totalGames);
        
        return gameStats;
    }
    
    /**
     * Verify if a Chess.com user exists
     */
    public boolean userExists(String username) {
        try {
            String userUrl = CHESS_COM_API_BASE + username;
            restTemplate.getForObject(userUrl, String.class);
            return true;
        } catch (HttpClientErrorException.NotFound e) {
            return false;
        } catch (Exception e) {
            logger.error("Error checking if user exists: {}", username, e);
            return false;
        }
    }

    /**
     * Fetch list of available game archives for a user
     * @param username Chess.com username
     * @return JsonNode containing archives array (URLs), or null if error
     */
    public JsonNode fetchAvailableArchives(String username) {
        try {
            String archivesUrl = CHESS_COM_API_BASE + username + "/games/archives";
            logger.info("Fetching available archives from: {}", archivesUrl);
            String response = restTemplate.getForObject(archivesUrl, String.class);

            if (response != null) {
                JsonNode rootNode = objectMapper.readTree(response);
                logger.info("Successfully fetched archives list - {} archives found",
                    rootNode.path("archives").size());
                return rootNode;
            }

        } catch (HttpClientErrorException.NotFound e) {
            logger.info("No archives found for user: {}", username);
            return null;
        } catch (Exception e) {
            logger.error("Error fetching archives for user: {}", username, e);
            return null;
        }

        return null;
    }

    /**
     * Fetch game archives for a specific month with retry logic for rate limiting
     * @param username Chess.com username
     * @param year Year (e.g., 2025)
     * @param month Month (1-12)
     * @return JsonNode containing games array, or null if no games available
     */
    public JsonNode fetchMonthlyGames(String username, int year, int month) {
        int maxRetries = 5;
        int retryCount = 0;
        long baseDelayMs = 1000; // Start with 1 second

        while (retryCount < maxRetries) {
            try {
                String gamesUrl = String.format("%s%s/games/%d/%02d",
                    CHESS_COM_API_BASE, username, year, month);

                logger.info("Fetching games from: {} (attempt {}/{})", gamesUrl, retryCount + 1, maxRetries);
                String response = restTemplate.getForObject(gamesUrl, String.class);

                if (response != null) {
                    JsonNode rootNode = objectMapper.readTree(response);
                    logger.info("Successfully fetched games for {}/{} - {} games found",
                        year, month, rootNode.path("games").size());
                    return rootNode;
                }

            } catch (HttpClientErrorException e) {
                if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                    retryCount++;
                    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
                    long delayMs = baseDelayMs * (1L << (retryCount - 1));

                    logger.warn("Rate limited (429) for {}/{}. Retry {}/{} after {}ms",
                        year, month, retryCount, maxRetries, delayMs);

                    if (retryCount < maxRetries) {
                        try {
                            Thread.sleep(delayMs);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            logger.error("Retry sleep interrupted", ie);
                            return null;
                        }
                        continue;
                    } else {
                        logger.error("Max retries exceeded for {}/{}. Giving up.", year, month);
                        return null;
                    }
                } else if (e.getStatusCode() == HttpStatus.NOT_FOUND) {
                    logger.info("No games found for {}/{} for user: {}", year, month, username);
                    return null;
                } else {
                    logger.error("HTTP error fetching games for {}/{}: {} - {}",
                        year, month, e.getStatusCode(), e.getMessage());
                    return null;
                }
            } catch (Exception e) {
                logger.error("Error fetching games for {}/{}: {}", year, month, e.getMessage());
                return null;
            }
        }

        return null;
    }
}
