package com.bdvitz.codingstats.service;

import com.bdvitz.codingstats.model.ChessStat;
import com.bdvitz.codingstats.repository.ChessStatRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChessStatsService {
    
    private static final Logger logger = LoggerFactory.getLogger(ChessStatsService.class);

    private final ChessStatRepository chessStatRepository;
    private final ChessComApiService chessComApiService;

    /**
    * Autowired is optional on constructors with a single constructor
    * Using constructor injection for better practices:
    * Makes dependencies explicit and immutable (final)
    * Easier to test (you can pass mock objects)
    * Prevents NullPointerException issues
    */
    public ChessStatsService(
            ChessStatRepository chessStatRepository,
            ChessComApiService chessComApiService) {
        this.chessStatRepository = chessStatRepository;
        this.chessComApiService = chessComApiService;
    }
    
    /**
     * Get current chess statistics, retrieving from repository if available
     * Otherwise fetch live stats from Chess.com API
     */
    public ChessStat getCurrentStats(String username) {
        logger.info("Getting current stats for user: {}", username);
        return chessStatRepository.findByUsername(username).orElse(fetchCurrentStats(username));
    }

    /**
     * Update current chess statistics in repository with live data from Chess.com API
     * and return the updated stats object
     */
    @Transactional
    public ChessStat fetchAndUpdateCurrentStats(String username) {
        ChessStat chessStat = fetchCurrentStats(username);
        logger.info("Updating repository with live stats for user: {}", username);
        chessStatRepository.save(chessStat);
        return chessStat;
    }

    /**
     * Fetch live stats from Chess.com API
     */
    public ChessStat fetchCurrentStats(String username) {
        logger.info("Fetching live chess.com api stats for user: {}", username);
        // Fetch stats from Chess.com API
        return chessComApiService.fetchChessStats(username);
    }

}
