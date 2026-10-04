package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Random;
import java.util.Set;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static com.bdvitz.codingstats.party.game.GameTestSupport.strike;
import static com.bdvitz.codingstats.party.game.GameTestSupport.target;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StrikeoutGameTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private StrikeoutGame game;
    private Player a;
    private Player b;
    private Player c;
    private Player d;
    private Player e;

    @BeforeEach
    void setUp() {
        game = new StrikeoutGame();
        a = player("p1");
        b = player("p2");
        c = player("p3");
        d = player("p4");
        e = player("p5");
        game.start(List.of(a, b, c, d, e), 0);
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    private JsonNode view(Player p) {
        return json(game.playerView(p));
    }

    /** Published strike count for a player, as the TV sees it. */
    private int shown(Player p) {
        for (JsonNode row : host().path("players")) {
            if (row.path("playerId").asText().equals(p.getId())) {
                return row.path("strikes").asInt();
            }
        }
        throw new AssertionError("player missing from view: " + p.getId());
    }

    private void publish(long now) {
        game.onTick(now);
    }

    @Test
    void startsWithThreeStrikesEachAndASixtySecondTimer() {
        assertEquals("PLAY", host().path("phase").asText());
        assertEquals(StrikeoutGame.ROUND_MS, host().path("deadline").asLong());
        assertEquals(3, host().path("maxStrikes").asInt());
        assertEquals(5, host().path("players").size());
        host().path("players").forEach(row -> assertEquals(0, row.path("strikes").asInt()));
        assertEquals(3, view(a).path("remaining").asInt());
        assertEquals(0, view(a).path("yourPicks").size());
    }

    @Test
    void canStrikeThreeDifferentPlayersButNotAFourth() {
        game.onInput(a, strike("p2", true), 1);
        game.onInput(a, strike("p3", true), 1);
        game.onInput(a, strike("p4", true), 1);
        assertEquals(0, view(a).path("remaining").asInt());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("p5", true), 1));
        assertEquals("No strikes left", ex.getMessage());
        assertEquals(Set.of("p2", "p3", "p4"), game.picksOf("p1"));
    }

    @Test
    void cannotStrikeYourself() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("p1", true), 1));
        assertEquals(Set.of(), game.picksOf("p1"));
    }

    @Test
    void strikingTheSamePlayerTwiceIsANoOp() {
        game.onInput(a, strike("p2", true), 1);
        game.onInput(a, strike("p2", true), 2);
        publish(StrikeoutGame.PUBLISH_MS);
        assertEquals(1, shown(b));
        assertEquals(2, view(a).path("remaining").asInt());
    }

    @Test
    void unstrikingRefundsTheStrikeForSomeoneElse() {
        game.onInput(a, strike("p2", true), 1);
        game.onInput(a, strike("p3", true), 1);
        game.onInput(a, strike("p4", true), 1);
        game.onInput(a, strike("p2", false), 2);
        assertEquals(1, view(a).path("remaining").asInt());
        game.onInput(a, strike("p5", true), 3);
        assertEquals(Set.of("p3", "p4", "p5"), game.picksOf("p1"));

        game.onInput(a, strike("p2", false), 4); // not struck: no-op
        assertEquals(0, view(a).path("remaining").asInt());
    }

    @Test
    void rejectsUnknownTargetsAndPlayersWhoWereNotSeated() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("p99", true), 1));
        Player outsider = player("p9");
        assertThrows(IllegalArgumentException.class, () -> game.onInput(outsider, strike("p2", true), 1));
        publish(StrikeoutGame.PUBLISH_MS);
        assertEquals(0, shown(b));
    }

    @Test
    void rejectsMalformedInputs() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, target("p2"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, choice(0), 1));
        assertThrows(IllegalArgumentException.class,
                () -> game.onInput(a, MAPPER.createObjectNode().put("kind", "strike").put("playerId", "p2"), 1));
        assertThrows(IllegalArgumentException.class,
                () -> game.onInput(a, MAPPER.createObjectNode().put("kind", "strike").put("playerId", "p2").put("on", "true"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("", true), 1));
        assertEquals(Set.of(), game.picksOf("p1"));
    }

    @Test
    void rejectsInputAtTheDeadlineEvenBeforeTheTick() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("p2", true), StrikeoutGame.ROUND_MS));
        assertEquals(Set.of(), game.picksOf("p1"));
    }

    @Test
    void countsArePublishedOncePerSecondNotPerTap() {
        assertFalse(game.onInput(a, strike("p2", true), 100), "inputs never broadcast directly");
        assertEquals(0, shown(b), "not published yet");
        assertEquals(List.of("p2"), List.of(view(a).path("yourPicks").get(0).asText()), "own picks show right away");

        assertFalse(game.onTick(500), "too early");
        assertTrue(game.onTick(StrikeoutGame.PUBLISH_MS));
        assertEquals(1, shown(b));
        assertFalse(game.onTick(2 * StrikeoutGame.PUBLISH_MS), "nothing changed");
    }

    @Test
    void deadlineFinishesAndChargesOnePointPerStrike() {
        game.onInput(a, strike("p2", true), 1);
        game.onInput(c, strike("p2", true), 1);
        game.onInput(d, strike("p3", true), 1);
        // e hands out nothing: unused strikes are forfeit, costing nobody anything

        assertTrue(game.onTick(StrikeoutGame.ROUND_MS));
        assertTrue(game.isFinished());
        JsonNode standings = host().path("standings");
        assertEquals("FINAL", host().path("phase").asText());
        assertEquals("p2", standings.get(4).path("playerId").asText(), "most strikes last");
        assertEquals(2, standings.get(4).path("strikes").asInt());
        assertEquals(-2, standings.get(4).path("points").asInt());
        assertEquals(0, standings.get(0).path("strikes").asInt());

        assertEquals(0, a.getScore());
        assertEquals(-2, b.getScore());
        assertEquals(-1, c.getScore());
        assertEquals(0, e.getScore());
        assertEquals(2, view(b).path("yourStrikes").asInt());
        assertFalse(game.onTick(StrikeoutGame.ROUND_MS + 5_000), "finishes only once");
        assertEquals(-2, b.getScore());
    }

    @Test
    void smallGamesGetFewerStrikes() {
        StrikeoutGame two = new StrikeoutGame();
        Player x = player("x");
        Player y = player("y");
        two.start(List.of(x, y), 0);
        assertEquals(1, json(two.hostView()).path("maxStrikes").asInt());
        two.onInput(x, strike("y", true), 1);
        assertThrows(IllegalArgumentException.class, () -> two.onInput(x, strike("x", true), 1));

        StrikeoutGame three = new StrikeoutGame();
        three.start(List.of(player("x"), player("y"), player("z")), 0);
        assertEquals(2, json(three.hostView()).path("maxStrikes").asInt());

        PartyException ex = assertThrows(PartyException.class, () -> new StrikeoutGame().start(List.of(player("x")), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", ex.getCode());
    }

    @Test
    void viewsNeverRevealWhoStruckWhom() {
        game.onInput(a, strike("p2", true), 1);
        game.onInput(a, strike("p3", true), 1);
        publish(StrikeoutGame.PUBLISH_MS);

        String hostJson = host().toString();
        assertFalse(hostJson.contains("yourPicks"));
        assertFalse(hostJson.contains("picks"));
        for (Player other : List.of(b, c, d)) {
            assertEquals(0, view(other).path("yourPicks").size(), "others only see their own (empty) picks");
        }
        assertEquals(2, view(a).path("yourPicks").size());

        game.onTick(StrikeoutGame.ROUND_MS);
        assertFalse(host().toString().contains("yourPicks"));
        assertTrue(view(a).path("yourPicks").isMissingNode(), "picks aren't revealed at the end either");
    }

    @Test
    void kickRemovesTheirStrikesAndRefundsStrikesAimedAtThem() {
        game.onInput(b, strike("p3", true), 1);
        game.onInput(a, strike("p2", true), 1);
        game.onInput(a, strike("p3", true), 1);
        game.onInput(a, strike("p4", true), 1);

        game.onPlayerRemoved(b);
        assertEquals(1, view(a).path("remaining").asInt(), "strike on the kicked player is refunded");
        assertTrue(game.onTick(StrikeoutGame.PUBLISH_MS));
        assertEquals(1, shown(c), "the kicked player's strike is gone");
        assertEquals(4, host().path("players").size());
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, strike("p2", true), 2));
    }

    @Test
    void randomInputsNeverBreakTheRules() {
        List<Player> players = List.of(a, b, c, d, e);
        List<String> ids = List.of("p1", "p2", "p3", "p4", "p5", "p99", "");
        Random random = new Random(42);
        long now = 1;
        for (int i = 0; i < 2000 && now < StrikeoutGame.ROUND_MS; i++, now += 20) {
            Player actor = players.get(random.nextInt(players.size()));
            try {
                game.onInput(actor, strike(ids.get(random.nextInt(ids.size())), random.nextBoolean()), now);
            } catch (IllegalArgumentException expected) {
                // invalid picks are rejected; the invariant below must still hold
            }
            int total = 0;
            for (Player p : players) {
                Set<String> picks = game.picksOf(p.getId());
                assertTrue(picks.size() <= 3, "at most 3 strikes");
                assertFalse(picks.contains(p.getId()), "never yourself");
                assertTrue(Set.of("p1", "p2", "p3", "p4", "p5").containsAll(picks), "only seated players");
                assertEquals(3 - picks.size(), view(p).path("remaining").asInt());
                total += picks.size();
            }
            game.onTick(now);
            if (now % StrikeoutGame.PUBLISH_MS == 1) { // a publish tick just ran
                int shownTotal = 0;
                for (Player p : players) {
                    shownTotal += shown(p);
                }
                assertEquals(total, shownTotal);
            }
        }
    }
}
