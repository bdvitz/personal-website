package com.bdvitz.codingstats.model;

import jakarta.persistence.*;
import java.time.LocalDate;
import java.time.ZoneOffset;

@Entity
@Table(name = "daily_ratings", 
       uniqueConstraints = @UniqueConstraint(columnNames = {"username", "date"}))
public class ChessDailyRating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String username;
    
    @Column(nullable = false)
    private LocalDate date;
    
    @Column(name = "rapid_rating")
    private Integer rapidRating;
    
    @Column(name = "blitz_rating")
    private Integer blitzRating;
    
    @Column(name = "bullet_rating")
    private Integer bulletRating;
    
    // Constructors
    public ChessDailyRating() {
        this.date = LocalDate.now(ZoneOffset.UTC);
    }
    
    public ChessDailyRating(String username, LocalDate date) {
        this.username = username;
        this.date = date;
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
    
    public LocalDate getDate() {
        return date;
    }
    
    public void setDate(LocalDate date) {
        this.date = date;
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
}
