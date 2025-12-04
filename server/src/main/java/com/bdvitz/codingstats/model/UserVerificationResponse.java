package com.bdvitz.codingstats.model;

public class UserVerificationResponse {

    private boolean exists;
    private String username;
    private Long joinedTimestamp;

    // Default constructor
    public UserVerificationResponse() {
    }

    // Constructor with all fields
    public UserVerificationResponse(boolean exists, String username, Long joinedTimestamp) {
        this.exists = exists;
        this.username = username;
        this.joinedTimestamp = joinedTimestamp;
    }

    // Constructor for failed verification
    public UserVerificationResponse(boolean exists, String username) {
        this.exists = exists;
        this.username = username;
        this.joinedTimestamp = null;
    }

    // Getters and Setters
    public boolean isExists() {
        return exists;
    }

    public void setExists(boolean exists) {
        this.exists = exists;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public Long getJoinedTimestamp() {
        return joinedTimestamp;
    }

    public void setJoinedTimestamp(Long joinedTimestamp) {
        this.joinedTimestamp = joinedTimestamp;
    }
}
