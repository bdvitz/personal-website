package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.number;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MedianMadnessGameTest {

    private MedianMadnessGame game;
    private Player a;
    private Player b;
    private Player c;
    private Player d;
    private Player e;
    private List<Player> all;

    @BeforeEach
    void setUp() {
        game = new MedianMadnessGame();
        a = player("p1");
        b = player("p2");
        c = player("p3");
        d = player("p4");
        e = player("p5");
        all = List.of(a, b, c, d, e);
    }

    private void start() {
        game.configure(Map.of());
        game.start(all, 0);
    }

    private void pick(Player p, int value) {
        game.onInput(p, number(String.valueOf(value)), 1);
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    private String phase() {
        return host().path("phase").asText();
    }

    /** Presses Next until the game is over. */
    private void skipToEnd() {
        for (int i = 0; i < 50 && !game.isFinished(); i++) {
            game.onAdvance(2);
        }
        assertTrue(game.isFinished());
    }

    private Map<String, JsonNode> rowsById() {
        Map<String, JsonNode> rows = new HashMap<>();
        host().path("rows").forEach(r -> rows.put(r.path("playerId").asText(), r));
        return rows;
    }

    @Test
    void needsTwoPlayers() {
        PartyException ex = assertThrows(PartyException.class, () -> game.start(List.of(a), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", ex.getCode());
    }

    @Test
    void timeLimitComesFromTheOptions() {
        game.configure(Map.of(MedianMadnessGame.OPTION_TIME_LIMIT, 30));
        game.start(all, 1_000);
        assertEquals(31_000, host().path("deadline").asLong());
        assertEquals(30, host().path("timeLimit").asInt());

        MedianMadnessGame sixty = new MedianMadnessGame();
        sixty.configure(GameRegistry.resolve(MedianMadnessGame.ID, Map.of()));
        sixty.start(all, 0);
        assertEquals(60_000, json(sixty.hostView()).path("deadline").asLong(), "default is 60s");
    }

    @Test
    void picksMustBeWholeNumbersFrom1To100() {
        start();
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("0"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("101"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("abc"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, choice(0), 1));
        pick(a, 1);
        pick(a, 100);
        assertEquals(100, json(game.playerView(a)).path("yourPick").asInt(), "a pick can be changed");
    }

    @Test
    void outsidersAndLateInputAreRejected() {
        start();
        Player stranger = player("p9");
        assertThrows(IllegalArgumentException.class, () -> game.onInput(stranger, number("5"), 1));
        game.onTick(MedianMadnessGame.DEFAULT_TIME_LIMIT_S * 1000L);
        assertEquals("SORTED", phase());
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("5"), 61_000));
    }

    @Test
    void submitViewsNeverShowOtherPlayersPicks() {
        start();
        pick(a, 42);
        assertEquals(List.of("p1"), List.of(host().path("answeredIds").get(0).asText()));
        assertEquals(1, host().path("answeredCount").asInt());
        assertFalse(host().toString().contains("42"), "TV doesn't see picks");
        assertFalse(json(game.playerView(b)).toString().contains("42"), "other phones don't see picks");
        assertTrue(json(game.playerView(b)).path("yourPick").isMissingNode());
        assertTrue(json(game.playerView(a)).path("answeredIds").isMissingNode());
    }

    @Test
    void endsEarlyWhenEveryConnectedPlayerHasPicked() {
        start();
        e.setConnected(false);
        pick(a, 10);
        pick(b, 20);
        pick(c, 30);
        assertEquals("SUBMIT", phase());
        pick(d, 40);
        assertEquals("SORTED", phase());
    }

    @Test
    void endsEarlyWhenTheLastHoldoutDisconnects() {
        start();
        pick(a, 10);
        pick(b, 20);
        pick(c, 30);
        pick(d, 40);
        assertFalse(game.onTick(2));
        e.setConnected(false);
        assertTrue(game.onTick(3));
        assertEquals("SORTED", phase());
    }

    @Test
    void duplicatesAndNoAnswersScoreZeroAndUniquesArePlacedByMedianOrder() {
        start();
        pick(a, 50);
        pick(b, 50); // duplicate
        pick(c, 10);
        pick(d, 90);
        // e never answers
        game.onTick(60_000);

        JsonNode rows = host().path("rows");
        assertEquals(List.of(10, 50, 50, 90), List.of(
                rows.get(0).path("value").asInt(), rows.get(1).path("value").asInt(),
                rows.get(2).path("value").asInt(), rows.get(3).path("value").asInt()), "sorted by number");
        assertEquals("p5", rows.get(4).path("playerId").asText(), "no-answer last");
        assertEquals("none", rows.get(4).path("status").asText());
        assertTrue(rows.get(4).path("value").isMissingNode());
        assertEquals("duplicate", rowsById().get("p1").path("status").asText());
        assertEquals("duplicate", rowsById().get("p2").path("status").asText());
        assertTrue(rowsById().get("p3").path("place").isMissingNode(), "places hidden until PLACING");

        skipToEnd();
        Map<String, JsonNode> byId = rowsById();
        // Unique [10, 90]: even length takes the upper middle first -> 90 is 1st, 10 is 2nd
        assertEquals(1, byId.get("p4").path("place").asInt());
        assertEquals(5, byId.get("p4").path("points").asInt(), "1st gets n = all 5 players");
        assertEquals(2, byId.get("p3").path("place").asInt());
        assertEquals(4, byId.get("p3").path("points").asInt());
        assertEquals(0, byId.get("p1").path("points").asInt());
        assertTrue(byId.get("p1").path("place").isMissingNode());
        assertEquals(0, byId.get("p5").path("points").asInt());

        assertEquals(5, d.getScore());
        assertEquals(4, c.getScore());
        assertEquals(0, a.getScore());
        assertEquals(0, b.getScore());
        assertEquals(0, e.getScore());
    }

    @Test
    void oddUniqueCountStartsAtTheMiddleThenGoesDown() {
        start();
        pick(a, 1);
        pick(b, 2);
        pick(c, 3);
        pick(d, 4);
        pick(e, 5);
        skipToEnd();
        Map<String, JsonNode> byId = rowsById();
        // [1..5] -> 3, 4, 2, 5, 1
        assertEquals(1, byId.get("p3").path("place").asInt());
        assertEquals(2, byId.get("p4").path("place").asInt());
        assertEquals(3, byId.get("p2").path("place").asInt());
        assertEquals(4, byId.get("p5").path("place").asInt());
        assertEquals(5, byId.get("p1").path("place").asInt());
        assertEquals(List.of(5, 4, 3, 2, 1), List.of(c.getScore(), d.getScore(), b.getScore(), e.getScore(), a.getScore()));
    }

    @Test
    void allDuplicatesMeansNobodyScores() {
        game.configure(Map.of());
        game.start(List.of(a, b), 0);
        pick(a, 7);
        pick(b, 7);
        skipToEnd();
        assertEquals(0, a.getScore());
        assertEquals(0, b.getScore());
        assertEquals(0, host().path("placeCount").asInt());
    }

    @Test
    void revealRunsOnTimersAndScoresOnlyAtTheEnd() {
        start();
        pick(a, 10);
        pick(b, 20);
        pick(c, 30);
        pick(d, 40);
        pick(e, 40);
        long t = 10;
        game.onTick(t); // already SORTED via early end at t=1
        assertEquals("SORTED", phase());
        t = 1 + MedianMadnessGame.SORTED_MS;
        game.onTick(t);
        assertEquals("DUPES", phase());
        t += MedianMadnessGame.DUPES_MS;
        game.onTick(t);
        assertEquals("ELIMINATED", phase());
        t += MedianMadnessGame.ELIMINATED_MS;
        game.onTick(t);
        assertEquals("PLACING", phase());
        assertEquals(1, host().path("revealedPlaces").asInt());
        assertEquals(3, host().path("placeCount").asInt());
        assertEquals(0, c.getScore(), "no points until FINAL");
        t += MedianMadnessGame.PLACE_MS;
        game.onTick(t);
        assertEquals(2, host().path("revealedPlaces").asInt());
        t += MedianMadnessGame.PLACE_MS;
        game.onTick(t);
        assertEquals(3, host().path("revealedPlaces").asInt());
        assertEquals("PLACING", phase(), "last place stays on screen for a beat");
        t += MedianMadnessGame.PLACE_MS;
        game.onTick(t);
        assertEquals("FINAL", phase());
        assertTrue(game.isFinished());
        assertEquals(5, b.getScore(), "unique [10,20,30] -> 20 is the median");
    }

    @Test
    void nextDuringPlacingRevealsEveryPlace() {
        start();
        pick(a, 10);
        pick(b, 20);
        pick(c, 30);
        pick(d, 40);
        pick(e, 50);
        game.onAdvance(2); // -> DUPES
        game.onAdvance(2); // -> ELIMINATED
        game.onAdvance(2); // -> PLACING (1 shown)
        assertEquals("PLACING", phase());
        game.onAdvance(2);
        assertEquals("FINAL", phase());
        assertEquals(5, host().path("revealedPlaces").asInt());
    }

    @Test
    void kickDuringSubmitDropsThePlayerAndKickAfterLockKeepsTheRowWithoutPoints() {
        start();
        pick(e, 55);
        game.onPlayerRemoved(e);
        pick(a, 10);
        pick(b, 20);
        pick(c, 30);
        pick(d, 40);
        assertEquals("SORTED", phase());
        assertEquals(4, host().path("rows").size());
        assertEquals(4, host().path("playerCount").asInt());

        game.onPlayerRemoved(c); // c is 1st: unique [10,20,30,40] -> 30 first
        skipToEnd();
        assertEquals(0, rowsById().get("p3").path("points").asInt());
        assertEquals(1, rowsById().get("p3").path("place").asInt(), "the row and place stay");
        assertEquals(0, c.getScore());
        assertEquals(3, b.getScore(), "20 is 2nd of 4 players");
    }
}
