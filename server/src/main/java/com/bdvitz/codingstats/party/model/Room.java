package com.bdvitz.codingstats.party.model;

import com.bdvitz.codingstats.party.game.PartyGame;
import org.springframework.web.socket.WebSocketSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

/**
 * In-memory party room. Not thread-safe on its own: every read or write must hold
 * {@code synchronized (room)}. RoomService and PartyHandler follow that rule.
 */
public class Room {

    private final String code;
    private final String hostToken;
    private volatile long lastActivity;
    private RoomStatus status = RoomStatus.LOBBY;
    private final List<Player> players = new ArrayList<>();
    /** Joined while a game was running; seated when the next game starts. */
    private final List<Player> waiting = new ArrayList<>();
    /** TV/host screens (usually one, but a refresh can briefly overlap). */
    private final Set<WebSocketSession> hostSessions = new HashSet<>();
    private String vipPlayerId;
    private PartyGame game;
    /** Game the next "start" will launch; shared so the TV and VIP phone show the same choice. */
    private String selectedGameId;
    /** gameId -> option key -> value picked in the lobby (e.g. Median Madness timeLimit). */
    private final Map<String, Map<String, Integer>> gameOptions = new HashMap<>();
    private boolean closed;
    private int nextPlayerNumber = 1;

    public Room(String code, String hostToken, long now) {
        this.code = code;
        this.hostToken = hostToken;
        this.lastActivity = now;
    }

    public String getCode() { return code; }
    public String getHostToken() { return hostToken; }

    public long getLastActivity() { return lastActivity; }
    public void touch(long now) { this.lastActivity = now; }

    public RoomStatus getStatus() { return status; }
    public void setStatus(RoomStatus status) { this.status = status; }

    public List<Player> getPlayers() { return players; }
    public List<Player> getWaiting() { return waiting; }
    public Set<WebSocketSession> getHostSessions() { return hostSessions; }

    public String getVipPlayerId() { return vipPlayerId; }
    public void setVipPlayerId(String vipPlayerId) { this.vipPlayerId = vipPlayerId; }

    public PartyGame getGame() { return game; }
    public void setGame(PartyGame game) { this.game = game; }

    public String getSelectedGameId() { return selectedGameId; }
    public void setSelectedGameId(String selectedGameId) { this.selectedGameId = selectedGameId; }

    public Map<String, Integer> getGameOptions(String gameId) {
        return gameOptions.getOrDefault(gameId, Map.of());
    }

    public void setGameOption(String gameId, String key, int value) {
        gameOptions.computeIfAbsent(gameId, id -> new HashMap<>()).put(key, value);
    }

    public boolean isClosed() { return closed; }
    public void setClosed(boolean closed) { this.closed = closed; }

    public String nextPlayerId() { return "p" + (nextPlayerNumber++); }

    public Stream<Player> allPlayers() {
        return Stream.concat(players.stream(), waiting.stream());
    }

    public int headCount() { return players.size() + waiting.size(); }

    public Optional<Player> findByToken(String token) {
        return allPlayers().filter(p -> p.getToken().equals(token)).findFirst();
    }

    public Optional<Player> findById(String id) {
        return allPlayers().filter(p -> p.getId().equals(id)).findFirst();
    }

    public boolean isWaiting(Player player) { return waiting.contains(player); }
}
