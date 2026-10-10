package com.bdvitz.codingstats.party;

import com.bdvitz.codingstats.party.game.GameRegistry;
import com.bdvitz.codingstats.party.game.PartyGame;
import com.bdvitz.codingstats.party.model.Player;
import com.bdvitz.codingstats.party.model.Room;
import com.bdvitz.codingstats.party.model.RoomStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Owns all party rooms (in memory only) and every room mutation.
 *
 * Concurrency: each public operation locks the room it touches, and state is broadcast to
 * every connected screen after each change (full state, per recipient). One daemon thread
 * ticks rooms every 250ms (so phase changes land close to the on-screen countdowns) to enforce
 * game deadlines and expire idle rooms.
 */
@Service
public class RoomService {

    private static final Logger logger = LoggerFactory.getLogger(RoomService.class);

    /** No I, L or O, so codes are easy to read off a TV. */
    private static final String CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ";
    private static final int CODE_LENGTH = 4;
    private static final int MAX_NAME_LENGTH = 16;
    private static final long CREATE_COOLDOWN_MS = 30_000;
    private static final long TICK_MS = 250;

    static final String ATTR_ROOM = "partyRoom";
    static final String ATTR_PLAYER = "partyPlayerId";
    static final String ATTR_HOST = "partyHost";

    private final ObjectMapper objectMapper;
    private final int maxRooms;
    private final int maxPlayers;
    private final long idleTimeoutMs;

    private final Map<String, Room> rooms = new ConcurrentHashMap<>();
    private final Map<String, Long> lastCreateByIp = new ConcurrentHashMap<>();
    private final SecureRandom random = new SecureRandom();
    private final ScheduledExecutorService ticker = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread thread = new Thread(r, "party-ticker");
        thread.setDaemon(true);
        return thread;
    });

    public RoomService(
            ObjectMapper objectMapper,
            @Value("${party.max-rooms:3}") int maxRooms,
            @Value("${party.max-players:16}") int maxPlayers,
            @Value("${party.idle-timeout-minutes:10}") long idleTimeoutMinutes) {
        this.objectMapper = objectMapper;
        this.maxRooms = maxRooms;
        this.maxPlayers = maxPlayers;
        this.idleTimeoutMs = TimeUnit.MINUTES.toMillis(idleTimeoutMinutes);
        ticker.scheduleAtFixedRate(this::tick, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
    }

    @PreDestroy
    public void shutdown() {
        ticker.shutdownNow();
    }

    // ---- REST-facing ----

    /**
     * Creates a room. If the caller proves it hosts a live room (code + host token), that room is
     * closed first, so one browser can't pile up rooms; that replacement also skips the cooldown
     * since it doesn't add a room.
     */
    public Room createRoom(String clientIp, String previousCode, String previousHostToken) {
        long now = System.currentTimeMillis();
        synchronized (rooms) {
            boolean replaced = false;
            Room previous = rooms.get(normalizeCode(previousCode));
            if (previous != null && previous.getHostToken().equals(previousHostToken)) {
                synchronized (previous) {
                    close(previous, "The host started a new room.");
                }
                replaced = true;
            }
            Long last = lastCreateByIp.get(clientIp);
            if (!replaced && last != null && now - last < CREATE_COOLDOWN_MS) {
                throw new PartyException("RATE_LIMITED", "You just created a room. Wait a few seconds and try again.");
            }
            if (rooms.size() >= maxRooms) {
                throw new PartyException("ROOMS_FULL", "All party rooms are in use right now. Try again later.");
            }
            String code;
            do {
                code = randomCode();
            } while (rooms.containsKey(code));
            Room room = new Room(code, UUID.randomUUID().toString(), now);
            room.setSelectedGameId(GameRegistry.DEFAULT_ID);
            rooms.put(code, room);
            lastCreateByIp.put(clientIp, now);
            logger.info("Party room {} created ({} active)", code, rooms.size());
            return room;
        }
    }

    public Optional<Map<String, Object>> describe(String code) {
        Room room = rooms.get(normalizeCode(code));
        if (room == null) {
            return Optional.empty();
        }
        synchronized (room) {
            Map<String, Object> info = new LinkedHashMap<>();
            info.put("code", room.getCode());
            info.put("status", room.getStatus().name());
            info.put("playerCount", room.headCount());
            info.put("maxPlayers", maxPlayers);
            return Optional.of(info);
        }
    }

    // ---- WebSocket-facing (session is the thread-safe decorated session) ----

    public void hostConnect(WebSocketSession session, String code, String hostToken) {
        Room room = requireRoom(code);
        synchronized (room) {
            ensureOpen(room);
            if (!room.getHostToken().equals(hostToken)) {
                throw new PartyException("BAD_HOST_TOKEN", "This screen isn't the host of that room.");
            }
            room.getHostSessions().add(session);
            session.getAttributes().put(ATTR_ROOM, room.getCode());
            session.getAttributes().put(ATTR_HOST, Boolean.TRUE);
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    public void join(WebSocketSession session, String code, String rawName) {
        Room room = requireRoom(code);
        synchronized (room) {
            ensureOpen(room);
            String name = cleanName(rawName);
            boolean taken = room.allPlayers().anyMatch(p -> p.getName().equalsIgnoreCase(name));
            if (taken) {
                throw new PartyException("NAME_TAKEN", "Someone in this room already has that name.");
            }
            if (room.headCount() >= maxPlayers) {
                throw new PartyException("ROOM_FULL", "This room is full (" + maxPlayers + " players).");
            }
            Player player = new Player(room.nextPlayerId(), name, UUID.randomUUID().toString());
            if (room.getStatus() == RoomStatus.IN_GAME) {
                room.getWaiting().add(player);
            } else {
                room.getPlayers().add(player);
            }
            if (room.getVipPlayerId() == null) {
                room.setVipPlayerId(player.getId());
            }
            attach(session, room, player);
            logger.info("Party room {}: {} joined ({} players)", room.getCode(), name, room.headCount());
            broadcast(room);
        }
    }

    public void rejoin(WebSocketSession session, String code, String token) {
        Room room = requireRoom(code);
        synchronized (room) {
            ensureOpen(room);
            Player player = room.findByToken(token == null ? "" : token)
                    .orElseThrow(() -> new PartyException("UNKNOWN_PLAYER", "You're no longer in this room. Join again."));
            WebSocketSession old = player.getSession();
            if (old != null && !old.getId().equals(session.getId()) && old.isOpen()) {
                // Same player opened a second tab: tell the old one to stop reconnecting.
                send(old, Map.of("type", "replaced"));
                closeQuietly(old);
            }
            attach(session, room, player);
            broadcast(room);
        }
    }

    /** Host or VIP changes which game "start" will launch (lobby or results screen). */
    public void selectGame(WebSocketSession actor, String gameId) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            if (!GameRegistry.exists(gameId)) {
                throw new PartyException("UNKNOWN_GAME", "Unknown game.");
            }
            room.setSelectedGameId(gameId);
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    /** Host or VIP picks a lobby option (e.g. a time limit) for the selected game. */
    public void setGameOption(WebSocketSession actor, String key, Integer value) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            if (room.getStatus() == RoomStatus.IN_GAME) {
                throw new PartyException("IN_GAME", "A game is already running.");
            }
            String gameId = room.getSelectedGameId();
            if (!GameRegistry.isValidOption(gameId, key, value)) {
                throw new PartyException("BAD_OPTION", "That option isn't available.");
            }
            room.setGameOption(gameId, key, value);
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    /** Starts gameId, or the room's selected game when gameId is null. */
    public void start(WebSocketSession actor, String gameId) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            if (room.getStatus() == RoomStatus.IN_GAME) {
                throw new PartyException("IN_GAME", "A game is already running.");
            }
            String id = gameId == null ? room.getSelectedGameId() : gameId;
            PartyGame game = GameRegistry.create(id)
                    .orElseThrow(() -> new PartyException("UNKNOWN_GAME", "Unknown game."));
            room.setSelectedGameId(id);
            room.getPlayers().addAll(room.getWaiting());
            room.getWaiting().clear();
            if (room.getPlayers().isEmpty()) {
                throw new PartyException("NO_PLAYERS", "Need at least one player to start.");
            }
            long now = System.currentTimeMillis();
            game.configure(GameRegistry.resolve(id, room.getGameOptions(id)));
            game.start(new ArrayList<>(room.getPlayers()), now);
            room.setGame(game);
            room.setStatus(RoomStatus.IN_GAME);
            room.touch(now);
            logger.info("Party room {}: started {} with {} players", room.getCode(), id, room.getPlayers().size());
            afterGameChange(room);
            broadcast(room);
        }
    }

    public void advance(WebSocketSession actor) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            long now = System.currentTimeMillis();
            room.touch(now);
            if (room.getStatus() == RoomStatus.IN_GAME && room.getGame().onAdvance(now)) {
                afterGameChange(room);
                broadcast(room);
            }
        }
    }

    /** Host or VIP sends a game-specific action (see {@link PartyGame#onControl}). */
    public void control(WebSocketSession actor, JsonNode action) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            if (room.getStatus() != RoomStatus.IN_GAME) {
                throw new PartyException("NOT_IN_GAME", "No game is running.");
            }
            long now = System.currentTimeMillis();
            room.touch(now);
            if (room.getGame().onControl(action, now)) {
                afterGameChange(room);
                broadcast(room);
            }
        }
    }

    public void input(WebSocketSession actor, JsonNode payload) {
        Room room = roomOf(actor);
        synchronized (room) {
            Player player = playerOf(room, actor);
            if (room.getStatus() != RoomStatus.IN_GAME || room.isWaiting(player)) {
                return;
            }
            long now = System.currentTimeMillis();
            room.touch(now);
            if (room.getGame().onInput(player, payload, now)) {
                afterGameChange(room);
                broadcast(room);
            }
        }
    }

    /** Abandon the current game or clear the results screen, back to the lobby. */
    public void backToLobby(WebSocketSession actor) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            returnToLobby(room);
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    public void kick(WebSocketSession actor, String playerId) {
        Room room = roomOf(actor);
        synchronized (room) {
            requireController(room, actor);
            Player player = room.findById(playerId == null ? "" : playerId)
                    .orElseThrow(() -> new PartyException("UNKNOWN_PLAYER", "That player already left."));
            boolean seated = room.getPlayers().remove(player);
            room.getWaiting().remove(player);
            if (seated && room.getGame() != null) {
                room.getGame().onPlayerRemoved(player);
            }
            if (player.getId().equals(room.getVipPlayerId())) {
                room.setVipPlayerId(room.allPlayers().findFirst().map(Player::getId).orElse(null));
            }
            if (player.getSession() != null) {
                send(player.getSession(), Map.of("type", "kicked"));
                closeQuietly(player.getSession());
            }
            room.touch(System.currentTimeMillis());
            afterGameChange(room);
            broadcast(room);
        }
    }

    /** Host screen hands VIP controls to another player (seated or waiting). */
    public void setVip(WebSocketSession actor, String playerId) {
        Room room = roomOf(actor);
        synchronized (room) {
            if (!isHost(actor)) {
                throw new PartyException("NOT_ALLOWED", "Only the host screen can change the VIP.");
            }
            Player player = room.findById(playerId == null ? "" : playerId)
                    .orElseThrow(() -> new PartyException("UNKNOWN_PLAYER", "That player already left."));
            room.setVipPlayerId(player.getId());
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    /** Host screen zeroes everyone's room total. Lobby only, so a running game's scoring isn't disturbed. */
    public void resetScores(WebSocketSession actor) {
        Room room = roomOf(actor);
        synchronized (room) {
            if (!isHost(actor)) {
                throw new PartyException("NOT_ALLOWED", "Only the host screen can reset scores.");
            }
            if (room.getStatus() != RoomStatus.LOBBY) {
                throw new PartyException("NOT_IN_LOBBY", "Scores can only be reset from the lobby.");
            }
            room.allPlayers().forEach(Player::resetScore);
            room.touch(System.currentTimeMillis());
            broadcast(room);
        }
    }

    /** Host screen ends the room early, freeing a slot. */
    public void closeRoom(WebSocketSession actor) {
        Room room = roomOf(actor);
        synchronized (room) {
            if (!isHost(actor)) {
                throw new PartyException("NOT_ALLOWED", "Only the host screen can close the room.");
            }
            close(room, "The host closed the room.");
        }
    }

    public void disconnected(WebSocketSession session) {
        String code = (String) session.getAttributes().get(ATTR_ROOM);
        Room room = code == null ? null : rooms.get(code);
        if (room == null) {
            return;
        }
        synchronized (room) {
            if (room.isClosed()) {
                return;
            }
            if (isHost(session)) {
                room.getHostSessions().removeIf(s -> s.getId().equals(session.getId()));
            } else {
                String playerId = (String) session.getAttributes().get(ATTR_PLAYER);
                room.findById(playerId == null ? "" : playerId).ifPresent(p -> {
                    // Ignore a stale socket closing after the player already reconnected elsewhere.
                    if (p.getSession() != null && p.getSession().getId().equals(session.getId())) {
                        p.setConnected(false);
                        p.setSession(null);
                    }
                });
            }
            broadcast(room);
        }
    }

    // ---- ticking ----

    private void tick() {
        try {
            long now = System.currentTimeMillis();
            for (Room room : rooms.values()) {
                synchronized (room) {
                    if (now - room.getLastActivity() > idleTimeoutMs) {
                        close(room, "Room closed after " + TimeUnit.MILLISECONDS.toMinutes(idleTimeoutMs)
                                + " minutes of inactivity.");
                        continue;
                    }
                    if (room.getStatus() == RoomStatus.IN_GAME && room.getGame().onTick(now)) {
                        afterGameChange(room);
                        broadcast(room);
                    }
                }
            }
            lastCreateByIp.values().removeIf(t -> now - t > CREATE_COOLDOWN_MS);
        } catch (Exception e) {
            // Never let an exception cancel the scheduled task.
            logger.error("Party tick failed", e);
        }
    }

    // ---- helpers (callers hold the room lock) ----

    private void attach(WebSocketSession session, Room room, Player player) {
        player.setSession(session);
        player.setConnected(true);
        session.getAttributes().put(ATTR_ROOM, room.getCode());
        session.getAttributes().put(ATTR_PLAYER, player.getId());
        room.touch(System.currentTimeMillis());
        send(session, Map.of("type", "joined", "playerId", player.getId(), "token", player.getToken(),
                "code", room.getCode()));
    }

    private void afterGameChange(Room room) {
        if (room.getStatus() == RoomStatus.IN_GAME && room.getGame().isFinished()) {
            if (room.getGame().returnsToLobby()) {
                returnToLobby(room);
            } else {
                room.setStatus(RoomStatus.GAME_OVER);
            }
        }
    }

    /** Seats waiting players and drops the game. Caller holds the room lock and broadcasts. */
    private void returnToLobby(Room room) {
        room.getPlayers().addAll(room.getWaiting());
        room.getWaiting().clear();
        room.setGame(null);
        room.setStatus(RoomStatus.LOBBY);
    }

    private void close(Room room, String reason) {
        room.setClosed(true);
        rooms.remove(room.getCode());
        Map<String, Object> msg = Map.of("type", "closed", "message", reason);
        List<WebSocketSession> sessions = new ArrayList<>(room.getHostSessions());
        room.allPlayers().map(Player::getSession).filter(s -> s != null).forEach(sessions::add);
        for (WebSocketSession s : sessions) {
            send(s, msg);
            closeQuietly(s);
        }
        logger.info("Party room {} closed: {} ({} active)", room.getCode(), reason, rooms.size());
    }

    private void broadcast(Room room) {
        long now = System.currentTimeMillis();
        if (!room.getHostSessions().isEmpty()) {
            String hostJson = toJson(stateMessage(room, null, now));
            for (WebSocketSession s : room.getHostSessions()) {
                sendRaw(s, hostJson);
            }
        }
        room.allPlayers().forEach(p -> {
            if (p.getSession() != null) {
                sendRaw(p.getSession(), toJson(stateMessage(room, p, now)));
            }
        });
    }

    private Map<String, Object> stateMessage(Room room, Player viewer, long now) {
        Map<String, Object> roomView = new LinkedHashMap<>();
        roomView.put("code", room.getCode());
        roomView.put("status", room.getStatus().name());
        roomView.put("maxPlayers", maxPlayers);
        if (room.getGame() != null) {
            roomView.put("gameId", room.getGame().id());
        }
        roomView.put("selectedGameId", room.getSelectedGameId());
        roomView.put("gameOptions", GameRegistry.resolve(room.getSelectedGameId(), room.getGameOptions(room.getSelectedGameId())));
        if (room.getVipPlayerId() != null) {
            roomView.put("vipPlayerId", room.getVipPlayerId());
        }
        // Private-score games: nobody (TV included) gets other players' totals until the game ends
        boolean hideScores = room.getStatus() == RoomStatus.IN_GAME && room.getGame().hidesScores();
        roomView.put("players", room.getPlayers().stream().map(p -> playerSummary(p, !hideScores)).toList());
        roomView.put("waiting", room.getWaiting().stream().map(p -> playerSummary(p, !hideScores)).toList());

        Map<String, Object> msg = new LinkedHashMap<>();
        msg.put("type", "state");
        msg.put("serverTime", now);
        msg.put("room", roomView);
        PartyGame game = room.getGame();
        if (viewer == null) {
            if (game != null) {
                msg.put("game", game.hostView());
            }
        } else {
            boolean waiting = room.isWaiting(viewer);
            msg.put("you", Map.of(
                    "playerId", viewer.getId(),
                    "name", viewer.getName(),
                    "waiting", waiting,
                    "vip", viewer.getId().equals(room.getVipPlayerId()),
                    "score", viewer.getScore()));
            if (game != null && !waiting) {
                msg.put("game", game.playerView(viewer));
            }
        }
        return msg;
    }

    private Map<String, Object> playerSummary(Player p, boolean includeScore) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("id", p.getId());
        summary.put("name", p.getName());
        summary.put("connected", p.isConnected());
        if (includeScore) {
            summary.put("score", p.getScore());
        }
        return summary;
    }

    private Room requireRoom(String code) {
        Room room = rooms.get(normalizeCode(code));
        if (room == null) {
            throw new PartyException("ROOM_NOT_FOUND", "No room with that code. Check the code on the TV.");
        }
        return room;
    }

    private void ensureOpen(Room room) {
        if (room.isClosed()) {
            throw new PartyException("ROOM_NOT_FOUND", "That room has closed.");
        }
    }

    private Room roomOf(WebSocketSession session) {
        String code = (String) session.getAttributes().get(ATTR_ROOM);
        Room room = code == null ? null : rooms.get(code);
        if (room == null) {
            throw new PartyException("ROOM_NOT_FOUND", "That room has closed.");
        }
        return room;
    }

    private Player playerOf(Room room, WebSocketSession session) {
        String playerId = (String) session.getAttributes().get(ATTR_PLAYER);
        return room.findById(playerId == null ? "" : playerId)
                .orElseThrow(() -> new PartyException("UNKNOWN_PLAYER", "You're no longer in this room. Join again."));
    }

    private boolean isHost(WebSocketSession session) {
        return Boolean.TRUE.equals(session.getAttributes().get(ATTR_HOST));
    }

    private void requireController(Room room, WebSocketSession actor) {
        if (isHost(actor)) {
            return;
        }
        String playerId = (String) actor.getAttributes().get(ATTR_PLAYER);
        if (playerId == null || !playerId.equals(room.getVipPlayerId())) {
            throw new PartyException("NOT_ALLOWED", "Only the host or VIP can do that.");
        }
    }

    private String cleanName(String raw) {
        String name = raw == null ? "" : raw.replaceAll("\\p{Cntrl}", "").trim().replaceAll("\\s+", " ");
        if (name.isEmpty() || name.length() > MAX_NAME_LENGTH) {
            throw new PartyException("BAD_NAME", "Names must be 1-" + MAX_NAME_LENGTH + " characters.");
        }
        return name;
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().toUpperCase();
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(CODE_LENGTH);
        for (int i = 0; i < CODE_LENGTH; i++) {
            sb.append(CODE_ALPHABET.charAt(random.nextInt(CODE_ALPHABET.length())));
        }
        return sb.toString();
    }

    void send(WebSocketSession session, Object message) {
        sendRaw(session, toJson(message));
    }

    private void sendRaw(WebSocketSession session, String json) {
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(json));
        } catch (IOException | IllegalStateException e) {
            logger.debug("Party send failed for session {}: {}", session.getId(), e.getMessage());
        }
    }

    private String toJson(Object message) {
        try {
            return objectMapper.writeValueAsString(message);
        } catch (IOException e) {
            throw new IllegalStateException("Could not serialize party message", e);
        }
    }

    private void closeQuietly(WebSocketSession session) {
        try {
            session.close(CloseStatus.NORMAL);
        } catch (IOException e) {
            logger.debug("Party close failed for session {}", session.getId());
        }
    }
}
