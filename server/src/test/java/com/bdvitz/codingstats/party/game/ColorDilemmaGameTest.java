package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.game.ColorDilemmaGame.Choice;
import com.bdvitz.codingstats.party.game.ColorDilemmaGame.Pair;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.IntStream;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static com.bdvitz.codingstats.party.game.ColorDilemmaGame.RESULT_MS;
import static com.bdvitz.codingstats.party.game.ColorDilemmaGame.ROUND_MS;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ColorDilemmaGameTest {

    private static final JsonNode GREEN = choice(0);
    private static final JsonNode RED = choice(1);

    private static List<Player> players(int n) {
        return IntStream.rangeClosed(1, n).mapToObj(i -> player("p" + i)).toList();
    }

    private static List<String> ids(int n) {
        return IntStream.rangeClosed(1, n).mapToObj(i -> "p" + i).toList();
    }

    /** Opponent id for this player in the current round (null = bye), read from the player's own view. */
    private static String opponent(ColorDilemmaGame game, Player p) {
        JsonNode view = json(game.playerView(p));
        return view.path("bye").asBoolean() ? null : view.path("opponent").path("id").asText();
    }

    private static String phase(ColorDilemmaGame game) {
        return json(game.hostView()).path("phase").asText();
    }

    // ---- rules ----

    @Test
    void payoffMatrix() {
        assertEquals(3, ColorDilemmaGame.payoff(Choice.GREEN, Choice.GREEN));
        assertEquals(1, ColorDilemmaGame.payoff(Choice.RED, Choice.RED));
        assertEquals(4, ColorDilemmaGame.payoff(Choice.RED, Choice.GREEN));
        assertEquals(0, ColorDilemmaGame.payoff(Choice.GREEN, Choice.RED));
    }

    @Test
    void roundCountIsTwiceOpponentsCappedAtTwelve() {
        assertEquals(2, ColorDilemmaGame.roundCount(2));
        assertEquals(4, ColorDilemmaGame.roundCount(3));
        assertEquals(10, ColorDilemmaGame.roundCount(6));
        assertEquals(12, ColorDilemmaGame.roundCount(7));
        assertEquals(12, ColorDilemmaGame.roundCount(8));
        assertEquals(12, ColorDilemmaGame.roundCount(15));
    }

    @Test
    void needsAtLeastTwoPlayers() {
        PartyException e = assertThrows(PartyException.class,
                () -> new ColorDilemmaGame().start(players(1), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", e.getCode());
    }

    // ---- schedule ----

    @Test
    void scheduleIsValidForEveryPartySize() {
        for (int n = 2; n <= 16; n++) {
            List<List<Pair>> schedule = ColorDilemmaGame.buildSchedule(ids(n), ColorDilemmaGame.roundCount(n));
            assertEquals(ColorDilemmaGame.roundCount(n), schedule.size(), "rounds for n=" + n);
            Map<String, Integer> meetings = new HashMap<>();
            for (List<Pair> round : schedule) {
                Set<String> seen = new HashSet<>();
                int byes = 0;
                for (Pair pair : round) {
                    assertNotEquals(pair.a(), pair.b(), "no self pairs");
                    assertTrue(seen.add(pair.a()), "nobody twice in a round (n=" + n + ")");
                    if (pair.b() == null) {
                        byes++;
                    } else {
                        assertTrue(seen.add(pair.b()), "nobody twice in a round (n=" + n + ")");
                        String key = pair.a().compareTo(pair.b()) < 0 ? pair.a() + "-" + pair.b() : pair.b() + "-" + pair.a();
                        meetings.merge(key, 1, Integer::sum);
                    }
                }
                assertEquals(n, seen.size(), "everyone plays or has the bye every round (n=" + n + ")");
                assertEquals(n % 2, byes, "exactly one bye when odd (n=" + n + ")");
            }
            meetings.values().forEach(count -> assertTrue(count <= 2, "a pair meets at most twice"));
        }
    }

    @Test
    void evenCountMeetsEveryoneInTheFirstCycle() {
        int n = 6;
        List<List<Pair>> schedule = ColorDilemmaGame.buildSchedule(ids(n), n - 1);
        Set<String> pairs = new HashSet<>();
        schedule.forEach(round -> round.forEach(p -> pairs.add(p.a().compareTo(p.b()) < 0 ? p.a() + p.b() : p.b() + p.a())));
        assertEquals(n * (n - 1) / 2, pairs.size());
    }

    @Test
    void oddCountRotatesTheBye() {
        List<List<Pair>> schedule = ColorDilemmaGame.buildSchedule(ids(5), 5);
        Set<String> byePlayers = new HashSet<>();
        schedule.forEach(round -> round.stream().filter(p -> p.b() == null).forEach(p -> byePlayers.add(p.a())));
        assertEquals(5, byePlayers.size(), "each player sits out once per cycle");
    }

    // ---- play ----

    @Test
    void defaultsToGreenAndLastToggleWins() {
        List<Player> ps = players(2);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        Player a = ps.get(0);
        Player b = ps.get(1);
        assertEquals("GREEN", json(game.playerView(a)).path("yourChoice").asText());

        game.onInput(a, RED, 1);
        game.onInput(a, GREEN, 2);
        game.onInput(a, RED, 3); // a ends on RED
        game.onInput(b, RED, 4);
        game.onInput(b, GREEN, 5); // b ends on GREEN
        assertEquals("RED", json(game.playerView(a)).path("yourChoice").asText());

        game.onTick(ROUND_MS);
        assertEquals("RESULT", phase(game));
        assertEquals(4, a.getScore());
        assertEquals(0, b.getScore());
        JsonNode result = json(game.playerView(b)).path("lastResult");
        assertEquals("GREEN", result.path("yourChoice").asText());
        assertEquals("RED", result.path("opponentChoice").asText());
        assertEquals(0, result.path("points").asInt());
    }

    @Test
    void untouchedPhonesBothStayGreen() {
        List<Player> ps = players(2);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        game.onTick(ROUND_MS);
        assertEquals(3, ps.get(0).getScore());
        assertEquals(3, ps.get(1).getScore());
    }

    @Test
    void runsAutomaticallyThroughAllRoundsThenFinishes() {
        List<Player> ps = players(3);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        long t = 0;
        for (int round = 1; round <= 4; round++) {
            assertEquals("ROUND", phase(game));
            assertEquals(round, json(game.hostView()).path("round").asInt());
            assertEquals(4, json(game.hostView()).path("rounds").asInt());
            assertFalse(game.onTick(t + ROUND_MS - 1), "round lasts 25s");
            assertFalse(game.onAdvance(t + 1), "no manual skipping");
            t += ROUND_MS;
            assertTrue(game.onTick(t));
            assertEquals("RESULT", phase(game));
            assertFalse(game.onTick(t + RESULT_MS - 1), "result pause lasts 5s");
            t += RESULT_MS;
            assertTrue(game.onTick(t));
        }
        assertTrue(game.isFinished());
        assertEquals(3, json(game.hostView()).path("standings").size());
        // 3 players, all GREEN, 4 rounds: each round the pair gets 3 each and the bye gets 2 -> 8 per round
        assertEquals(32, ps.stream().mapToInt(Player::getScore).sum());
        // one cycle gives everyone one bye (11 pts); the 4th round gives one player a second bye (10 pts)
        ps.forEach(p -> assertTrue(p.getScore() == 10 || p.getScore() == 11, "score " + p.getScore()));
    }

    @Test
    void byeScoresTwoAndShowsOnThePhone() {
        List<Player> ps = players(3);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        Player byePlayer = ps.stream().filter(p -> opponent(game, p) == null).findFirst().orElseThrow();
        assertEquals(2, json(game.playerView(byePlayer)).path("byePoints").asInt(), "phone shows the bye value");
        game.onInput(byePlayer, RED, 1); // choice is irrelevant on a bye
        game.onTick(ROUND_MS);
        assertEquals(2, byePlayer.getScore());
        assertTrue(json(game.playerView(byePlayer)).path("lastResult").path("bye").asBoolean());
    }

    @Test
    void inputOutsideRoundIsIgnored() {
        List<Player> ps = players(2);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        game.onTick(ROUND_MS);
        assertFalse(game.onInput(ps.get(0), RED, ROUND_MS + 1));
        assertThrows(IllegalArgumentException.class, () -> {
            ColorDilemmaGame g = new ColorDilemmaGame();
            g.start(players(2), 0);
            g.onInput(ps.get(0), choice(2), 1);
        });
    }

    // ---- privacy ----

    @Test
    void viewsNeverLeakChoicesOrOtherScores() {
        List<Player> ps = players(4);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        Player a = ps.get(0);
        game.onInput(a, RED, 1);
        Player opp = ps.stream().filter(p -> p.getId().equals(opponent(game, a))).findFirst().orElseThrow();

        String host = json(game.hostView()).toString();
        assertFalse(host.contains("RED") || host.contains("GREEN") || host.contains("points"), host);
        JsonNode oppView = json(game.playerView(opp));
        assertEquals("GREEN", oppView.path("yourChoice").asText(), "opponent sees only their own pick");
        assertFalse(oppView.toString().contains("RED"), "a's RED is not visible to the opponent mid-round");

        game.onTick(ROUND_MS);
        String hostAfter = json(game.hostView()).toString();
        assertFalse(hostAfter.contains("RED") || hostAfter.contains("points"), "TV shows no results mid-game");
        assertTrue(json(game.playerView(a)).path("standings").isMissingNode(), "no leaderboard until the end");
    }

    // ---- removal ----

    @Test
    void kickedOpponentBecomesAByeForTheRestOfTheGame() {
        List<Player> ps = players(4);
        ColorDilemmaGame game = new ColorDilemmaGame();
        game.start(ps, 0);
        Player a = ps.get(0);
        Player opp = ps.stream().filter(p -> p.getId().equals(opponent(game, a))).findFirst().orElseThrow();
        game.onPlayerRemoved(opp);
        assertTrue(json(game.playerView(a)).path("bye").asBoolean());
        game.onTick(ROUND_MS);
        assertEquals(2, a.getScore(), "bye points instead of a match");
        assertEquals(0, opp.getScore(), "removed player earns nothing");

        List<String> remaining = new ArrayList<>();
        JsonNode pairs = json(game.hostView()).path("pairs");
        pairs.forEach(p -> {
            remaining.add(p.path("a").path("id").asText());
            if (p.has("b")) {
                remaining.add(p.path("b").path("id").asText());
            }
        });
        assertFalse(remaining.contains(opp.getId()));
    }
}
