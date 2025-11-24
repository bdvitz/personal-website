package com.bdvitz.codingstats.repository;

import com.bdvitz.codingstats.model.ChessDailyRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface ChessDailyRatingRepository extends JpaRepository<ChessDailyRating, Long> {

    boolean existsByUsername(String username);

    Optional<ChessDailyRating> findByUsernameAndDate(String username, LocalDate date);
    
    List<ChessDailyRating> findByUsernameOrderByDateAsc(String username);
    
    @Query("SELECT d FROM DailyRating d WHERE d.username = :username AND d.date >= :startDate ORDER BY d.date ASC")
    List<ChessDailyRating> findByUsernameAndDateAfter(@Param("username") String username, 
                                                   @Param("startDate") LocalDate startDate);
    
    @Query("SELECT d FROM DailyRating d WHERE d.username = :username AND d.date BETWEEN :startDate AND :endDate ORDER BY d.date ASC")
    List<ChessDailyRating> findByUsernameAndDateBetween(@Param("username") String username,
                                                     @Param("startDate") LocalDate startDate,
                                                     @Param("endDate") LocalDate endDate);
}
