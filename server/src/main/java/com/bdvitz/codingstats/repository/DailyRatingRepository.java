package com.bdvitz.codingstats.repository;

import com.bdvitz.codingstats.model.DailyRating;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface DailyRatingRepository extends JpaRepository<DailyRating, Long> {
    
    Optional<DailyRating> findByUsernameAndDate(String username, LocalDate date);
    
    List<DailyRating> findByUsernameOrderByDateAsc(String username);
    
    @Query("SELECT d FROM DailyRating d WHERE d.username = :username AND d.date >= :startDate ORDER BY d.date ASC")
    List<DailyRating> findByUsernameAndDateAfter(@Param("username") String username, 
                                                   @Param("startDate") LocalDate startDate);
    
    @Query("SELECT d FROM DailyRating d WHERE d.username = :username AND d.date BETWEEN :startDate AND :endDate ORDER BY d.date ASC")
    List<DailyRating> findByUsernameAndDateBetween(@Param("username") String username,
                                                     @Param("startDate") LocalDate startDate,
                                                     @Param("endDate") LocalDate endDate);
}
