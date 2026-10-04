package com.bdvitz.codingstats.party;

import com.bdvitz.codingstats.party.model.Room;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Room rules without Spring or real sockets: mocked sessions record what the server sends. */
class RoomServiceTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final int MAX_PLAYERS = 4;

    private RoomService service;
    private Room room;
    private int sessionCounter;

    /** A fake screen: a mocked session plus everything the server sent to it. */
    private class Client {
        final WebSocketSession session = mock(WebSocketSession.class);
        final List<JsonNode> received = new ArrayList<>();

        Client() {
            Map<String, Object> attributes = new HashMap<>();
            String id = "s" + (++sessionCounter);
            when(session.getAttributes()).thenReturn(attributes);
            when(session.getId()).thenReturn(id);
            when(session.isOpen()).thenReturn(true);
            try {
                doAnswer(inv -> {
                    received.add(MAPPER.readTree(((TextMessage) inv.getArgument(0)).getPayload()));
                    return null;
                }).when(session).sendMessage(any());
            } catch (IOException e) {
                throw new IllegalStateException(e); // stubbing never actually sends
            }
        }

        JsonNode last(String type) {
            for (int i = received.size() - 1; i >= 0; i--) {
                if (type.equals(received.get(i).path("type").asText())) {
                    return received.get(i);
                }
            }
            return null;
        }

        JsonNode state() {
            return last("state");
        }

        String playerId() {
            return last("joined").path("playerId").asText();
        }
    }

    @BeforeEach
    void setUp() {
        service = new RoomService(MAPPER, 3, MAX_PLAYERS, 10);
        room = service.createRoom("10.0.0.1", null, null);
    }

    @AfterEach
    void tearDown() {
        service.shutdown();
    }

    private Client host() throws Exception {
        Client host = new Client();
        service.hostConnect(host.session, room.getCode(), room.getHostToken());
        return host;
    }

    private Client join(String name) throws Exception {
        Client c = new Client();
        service.join(c.session, room.getCode(), name);
        return c;
    }

    private static String code(Runnable action) {
        return assertThrows(PartyException.class, action::run).getCode();
    }

    // ---- creation ----

    @Test
    void roomCapAndPerIpCooldown() {
        assertEquals("RATE_LIMITED", code(() -> service.createRoom("10.0.0.1", null, null)));
        service.createRoom("10.0.0.2", null, null);
        service.createRoom("10.0.0.3", null, null);
        assertEquals("ROOMS_FULL", code(() -> service.createRoom("10.0.0.4", null, null)));
    }

    @Test
    void replacingYourOwnRoomClosesItAndSkipsCooldown() throws Exception {
        Client host = host();
        assertEquals("RATE_LIMITED", code(() -> service.createRoom("10.0.0.1", room.getCode(), "wrong-token")));
        Room next = service.createRoom("10.0.0.1", room.getCode(), room.getHostToken());
        assertNotNull(host.last("closed"));
        assertTrue(service.describe(room.getCode()).isEmpty());
        assertTrue(service.describe(next.getCode()).isPresent());
    }

    @Test
    void lookupIsCaseInsensitiveAndHostTokenIsChecked() throws Exception {
        assertTrue(service.describe(room.getCode().toLowerCase()).isPresent());
        Client imposter = new Client();
        assertEquals("BAD_HOST_TOKEN", code(() -> service.hostConnect(imposter.session, room.getCode(), "nope")));
        assertEquals("ROOM_NOT_FOUND", code(() -> service.hostConnect(imposter.session, "ZZZZ", room.getHostToken())));
    }

    // ---- joining ----

    @Test
    void firstJoinerIsVipAndNamesAreValidated() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        join("Bob");
        assertTrue(alice.state().path("you").path("vip").asBoolean());
        assertEquals(2, host.state().path("room").path("players").size());
        assertEquals("NAME_TAKEN", code(() -> service.join(new Client().session, room.getCode(), "  alice ")));
        assertEquals("BAD_NAME", code(() -> service.join(new Client().session, room.getCode(), "   ")));
        assertEquals("BAD_NAME", code(() -> service.join(new Client().session, room.getCode(), "x".repeat(17))));
    }

    @Test
    void roomFullAtMaxPlayers() throws Exception {
        for (int i = 0; i < MAX_PLAYERS; i++) {
            join("P" + i);
        }
        assertEquals("ROOM_FULL", code(() -> service.join(new Client().session, room.getCode(), "Late")));
    }

    @Test
    void midGameJoinerWaitsWithoutGameViewAndIsSeatedNextGame() throws Exception {
        Client alice = join("Alice");
        service.start(alice.session, "warmup"); // solo-friendly game
        Client late = join("Late");
        assertTrue(late.state().path("you").path("waiting").asBoolean());
        assertTrue(late.state().path("game").isMissingNode());
        assertEquals(1, alice.state().path("room").path("waiting").size());

        service.backToLobby(alice.session);
        assertEquals("LOBBY", late.state().path("room").path("status").asText());
        assertFalse(late.state().path("you").path("waiting").asBoolean(), "back to lobby seats waiting players");
    }

    // ---- reconnecting ----

    @Test
    void rejoinRestoresSeatAndStaleDisconnectIsIgnored() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        String token = alice.last("joined").path("token").asText();
        String id = alice.playerId();

        service.disconnected(alice.session);
        assertFalse(host.state().path("room").path("players").get(0).path("connected").asBoolean());

        Client phone2 = new Client();
        service.rejoin(phone2.session, room.getCode(), token);
        assertEquals(id, phone2.playerId());
        assertTrue(host.state().path("room").path("players").get(0).path("connected").asBoolean());

        Client phone3 = new Client();
        service.rejoin(phone3.session, room.getCode(), token);
        assertNotNull(phone2.last("replaced"), "older tab is told to stop reconnecting");
        service.disconnected(phone2.session);
        assertTrue(host.state().path("room").path("players").get(0).path("connected").asBoolean(),
                "the replaced tab closing must not mark the player offline");

        assertEquals("UNKNOWN_PLAYER", code(() -> service.rejoin(new Client().session, room.getCode(), "bad-token")));
    }

    // ---- permissions ----

    @Test
    void onlyHostOrVipCanControlTheGame() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        assertEquals("NOT_ALLOWED", code(() -> service.start(bob.session, null)));
        assertEquals("NOT_ALLOWED", code(() -> service.selectGame(bob.session, "strikeout")));
        assertEquals("NOT_ALLOWED", code(() -> service.kick(bob.session, alice.playerId())));
        assertEquals("NOT_ALLOWED", code(() -> service.closeRoom(alice.session)), "VIP can't close the room");

        service.selectGame(alice.session, "strikeout");
        assertEquals("strikeout", host.state().path("room").path("selectedGameId").asText());
        service.start(host.session, null);
        assertEquals("strikeout", bob.state().path("room").path("gameId").asText(), "start uses the selected game");
        assertEquals("NOT_ALLOWED", code(() -> service.advance(bob.session)));
        assertEquals("IN_GAME", code(() -> service.start(alice.session, null)));
    }

    @Test
    void selectGameRejectsUnknownIds() throws Exception {
        Client host = host();
        assertEquals("UNKNOWN_GAME", code(() -> service.selectGame(host.session, "nope")));
        assertEquals("UNKNOWN_GAME", code(() -> service.start(host.session, "nope")));
        assertEquals("colordilemma", host.state().path("room").path("selectedGameId").asText(), "default game");
    }

    @Test
    void gameOptionsAreValidatedSharedAndUsedAtStart() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        assertTrue(host.state().path("room").path("gameOptions").isEmpty(), "default game has no options");
        assertEquals("BAD_OPTION", code(() -> service.setGameOption(host.session, "timeLimit", 30)));

        service.selectGame(host.session, "medianmadness");
        assertEquals(60, alice.state().path("room").path("gameOptions").path("timeLimit").asInt(), "default shown");
        assertEquals("NOT_ALLOWED", code(() -> service.setGameOption(bob.session, "timeLimit", 30)));
        assertEquals("BAD_OPTION", code(() -> service.setGameOption(host.session, "timeLimit", 45)));
        assertEquals("BAD_OPTION", code(() -> service.setGameOption(host.session, "timeLimit", null)));
        assertEquals("BAD_OPTION", code(() -> service.setGameOption(host.session, "nope", 30)));

        service.setGameOption(alice.session, "timeLimit", 30);
        assertEquals(30, host.state().path("room").path("gameOptions").path("timeLimit").asInt());
        service.start(host.session, null);
        assertEquals(30, bob.state().path("game").path("timeLimit").asInt());
        assertEquals("IN_GAME", code(() -> service.setGameOption(host.session, "timeLimit", 60)));
    }

    @Test
    void controlActionsAreForHostOrVipDuringAGame() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        JsonNode startRound = MAPPER.createObjectNode().put("action", "startRound");
        assertEquals("NOT_IN_GAME", code(() -> service.control(host.session, startRound)));

        service.start(host.session, "cardconundrum");
        assertEquals("NOT_ALLOWED", code(() -> service.control(bob.session, startRound)));
        service.control(alice.session, startRound);
        assertEquals("COUNTDOWN", bob.state().path("game").path("phase").asText());
        assertThrows(IllegalArgumentException.class, () -> service.control(host.session, startRound), "wrong phase");
    }

    @Test
    void vipCanReturnToLobbyFromResults() throws Exception {
        Client alice = join("Alice");
        service.start(alice.session, "warmup");
        for (int i = 0; i < 4; i++) {
            service.advance(alice.session);
        }
        assertEquals("GAME_OVER", alice.state().path("room").path("status").asText());
        service.backToLobby(alice.session);
        assertEquals("LOBBY", alice.state().path("room").path("status").asText());
        assertTrue(alice.state().path("game").isMissingNode());
    }

    @Test
    void onlyHostCanChangeVip() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        assertEquals("NOT_ALLOWED", code(() -> service.setVip(alice.session, bob.playerId())));
        service.setVip(host.session, bob.playerId());
        assertTrue(bob.state().path("you").path("vip").asBoolean());
        assertFalse(alice.state().path("you").path("vip").asBoolean());
        assertEquals("UNKNOWN_PLAYER", code(() -> service.setVip(host.session, "p99")));
    }

    @Test
    void hostCanResetScoresOnlyFromTheLobby() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        service.start(alice.session, "warmup");
        JsonNode answer = MAPPER.createObjectNode().put("kind", "choice").put("index", 0);
        service.input(alice.session, answer); // a solo poll answer is the majority -> 1 point
        assertEquals(1, host.state().path("room").path("players").get(0).path("score").asInt());

        assertEquals("NOT_IN_LOBBY", code(() -> service.resetScores(host.session)));
        service.backToLobby(host.session);
        assertEquals("NOT_ALLOWED", code(() -> service.resetScores(alice.session)), "VIP can't reset scores");
        service.resetScores(host.session);
        assertEquals(0, alice.state().path("room").path("players").get(0).path("score").asInt());
    }

    @Test
    void colorDilemmaNeedsTwoPlayersAndRefusalLeavesRoomInLobby() throws Exception {
        Client host = host();
        join("Alice");
        assertEquals("NOT_ENOUGH_PLAYERS", code(() -> service.start(host.session, null)));
        assertEquals("LOBBY", host.state().path("room").path("status").asText());
    }

    @Test
    void privateScoreGameHidesEveryonesScoresExceptYourOwn() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        service.start(host.session, "colordilemma");
        for (Client c : List.of(host, alice, bob)) {
            c.state().path("room").path("players")
                    .forEach(p -> assertTrue(p.path("score").isMissingNode(), "no scores in room state mid-game"));
        }
        assertEquals(0, alice.state().path("you").path("score").asInt(), "own score still sent");

        service.backToLobby(host.session);
        host.state().path("room").path("players")
                .forEach(p -> assertFalse(p.path("score").isMissingNode(), "scores visible again in the lobby"));
    }

    @Test
    void kickingTheVipPassesVipOnAndNotifiesThePlayer() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        Client bob = join("Bob");
        service.start(alice.session, null);
        service.kick(host.session, alice.playerId());
        assertNotNull(alice.last("kicked"));
        assertTrue(bob.state().path("you").path("vip").asBoolean());
        assertEquals(1, host.state().path("room").path("players").size());
        assertEquals("UNKNOWN_PLAYER", code(() -> service.rejoin(new Client().session, room.getCode(),
                alice.last("joined").path("token").asText())));
    }

    @Test
    void closeRoomNotifiesEveryoneAndFreesTheSlot() throws Exception {
        Client host = host();
        Client alice = join("Alice");
        service.closeRoom(host.session);
        assertNotNull(host.last("closed"));
        assertNotNull(alice.last("closed"));
        assertTrue(service.describe(room.getCode()).isEmpty());
        assertEquals("ROOM_NOT_FOUND", code(() -> service.join(new Client().session, room.getCode(), "Late")));
    }

    @Test
    void invalidGameInputIsReportedAndWaitingPlayersInputIsIgnored() throws Exception {
        Client alice = join("Alice");
        join("Bob");
        service.start(alice.session, "warmup");
        JsonNode badChoice = MAPPER.createObjectNode().put("kind", "choice").put("index", 9);
        assertThrows(IllegalArgumentException.class, () -> service.input(alice.session, badChoice));

        Client late = join("Late");
        JsonNode goodChoice = MAPPER.createObjectNode().put("kind", "choice").put("index", 0);
        service.input(late.session, goodChoice);
        assertEquals(0, alice.state().path("room").path("players").get(0).path("score").asInt());
        assertTrue(late.state().path("game").isMissingNode());
    }
}
