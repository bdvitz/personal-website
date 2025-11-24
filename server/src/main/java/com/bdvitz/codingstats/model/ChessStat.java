package com.bdvitz.codingstats.model;

import jakarta.persistence.*;
import java.time.LocalDate;

@Entity
@Table(name = "chess_stats")
public class ChessStat {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, unique = true)
    private String username;
    
    @Column(name = "rapid_rating")
    private Integer rapidRating;
    
    @Column(name = "blitz_rating")
    private Integer blitzRating;
    
    @Column(name = "bullet_rating")
    private Integer bulletRating;
    
    @Column(name = "puzzle_rating")
    private Integer puzzleRating;
    
    @Column(name = "total_games")
    private Integer totalGames;
    
    private Integer wins;
    private Integer losses;
    private Integer draws;
    
    @Column(name = "last_updated")
    private LocalDate lastUpdated;
    
    // Constructors
    public ChessStat() {
        this.lastUpdated = LocalDate.now();
    }
    
    public ChessStat(String username) {
        this.username = username;
        this.lastUpdated = LocalDate.now();
    }
    
    // Getters and Setters
    public Long getId() {
        return id;
    }
    
    public void setId(Long id) {
        this.id = id;
    }
    
    public String getUsername() {
        return username;
    }
    
    public void setUsername(String username) {
        this.username = username;
    }
    
    public Integer getRapidRating() {
        return rapidRating;
    }
    
    public void setRapidRating(Integer rapidRating) {
        this.rapidRating = rapidRating;
    }
    
    public Integer getBlitzRating() {
        return blitzRating;
    }
    
    public void setBlitzRating(Integer blitzRating) {
        this.blitzRating = blitzRating;
    }
    
    public Integer getBulletRating() {
        return bulletRating;
    }
    
    public void setBulletRating(Integer bulletRating) {
        this.bulletRating = bulletRating;
    }
    
    public Integer getPuzzleRating() {
        return puzzleRating;
    }
    
    public void setPuzzleRating(Integer puzzleRating) {
        this.puzzleRating = puzzleRating;
    }
    
    public Integer getTotalGames() {
        return totalGames;
    }
    
    public void setTotalGames(Integer totalGames) {
        this.totalGames = totalGames;
    }
    
    public Integer getWins() {
        return wins;
    }
    
    public void setWins(Integer wins) {
        this.wins = wins;
    }
    
    public Integer getLosses() {
        return losses;
    }
    
    public void setLosses(Integer losses) {
        this.losses = losses;
    }
    
    public Integer getDraws() {
        return draws;
    }
    
    public void setDraws(Integer draws) {
        this.draws = draws;
    }
    
    public LocalDate getLastUpdated() {
        return lastUpdated;
    }
    
    public void setLastUpdated(LocalDate lastUpdated) {
        this.lastUpdated = lastUpdated;
    }
    
    @PreUpdate
    public void preUpdate() {
        this.lastUpdated = LocalDate.now();
    }
}
