package com.bdvitz.codingstats.party.model;

import org.springframework.web.socket.WebSocketSession;

/**
 * A phone in a room. Players are never removed on disconnect, so a reconnect with the same
 * token resumes the same seat and score. All mutation happens under the owning Room's lock.
 */
public class Player {

    private final String id;
    private final String name;
    private final String token;
    private WebSocketSession session;
    private boolean connected;
    private int score;

    public Player(String id, String name, String token) {
        this.id = id;
        this.name = name;
        this.token = token;
    }

    public String getId() { return id; }
    public String getName() { return name; }
    public String getToken() { return token; }

    public WebSocketSession getSession() { return session; }
    public void setSession(WebSocketSession session) { this.session = session; }

    public boolean isConnected() { return connected; }
    public void setConnected(boolean connected) { this.connected = connected; }

    /** Room-level running total across all games played in the room. */
    public int getScore() { return score; }
    public void addScore(int points) { this.score += points; }
    public void resetScore() { this.score = 0; }
}
