package com.bdvitz.codingstats.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpClientErrorException;

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
        
        String[] gameModes = {"chess_rapid", "chess_blitz", "chess_bullet", "chess_daily"};
        
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
}
