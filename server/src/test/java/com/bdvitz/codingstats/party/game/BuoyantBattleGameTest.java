package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

import static com.bdvitz.codingstats.party.game.GameTestSupport.cell;
import static com.bdvitz.codingstats.party.game.GameTestSupport.confirm;
import static com.bdvitz.codingstats.party.game.GameTestSupport.handoff;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.place;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static com.bdvitz.codingstats.party.game.GameTestSupport.target;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BuoyantBattleGameTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    /** The fleet placeFleet() lays out, in sinking order: ship 0 (3 long), ship 1, ship 2. */
    private static final int[][] FLEET = {{0, 0}, {0, 1}, {0, 2}, {2, 0}, {2, 1}, {4, 0}, {4, 1}};
    /** Squares placeFleet() leaves empty. */
    private static final int[][] WATER = {{1, 0}, {1, 1}, {1, 2}, {1, 3}, {1, 4}, {3, 0}, {3, 1}, {3, 2}, {3, 3}, {3, 4}};

    private BuoyantBattleGame game;
    private List<Player> players;
    private Map<String, Player> byId;
    private long now;

    private void start(int n, long seed) {
        game = new BuoyantBattleGame(new Random(seed));
        players = IntStream.rangeClosed(1, n).mapToObj(i -> player("p" + i)).toList();
        byId = players.stream().collect(Collectors.toMap(Player::getId, Function.identity()));
        now = 0;
        game.start(players, now);
    }

    private void start(int n) {
        start(n, 42);
    }

    private static JsonNode action(String name) {
        return MAPPER.createObjectNode().put("action", name);
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    private JsonNode phone(Player p) {
        return json(game.playerView(p));
    }

    private String phase() {
        return host().path("phase").asText();
    }

    private List<Player> team(int t) {
        List<Player> list = new ArrayList<>();
        host().path("teams").path(t).path("players").forEach(p -> list.add(byId.get(p.path("playerId").asText())));
        return list;
    }

    private Player leader(int t) {
        return byId.get(host().path("teams").path(t).path("leaderId").asText());
    }

    private void input(Player p, JsonNode in) {
        game.onInput(p, in, now);
    }

    private void placeFleet(int t) {
        Player l = leader(t);
        input(l, place(0, 0, 0, false));
        input(l, place(1, 2, 0, false));
        input(l, place(2, 4, 0, false));
    }

    /** Closes the vote, places the standard fleet on both boards and readies up. */
    private void toBombing() {
        if (phase().equals("ELECTION")) {
            game.onControl(action("closeVote"), now);
        }
        placeFleet(0);
        placeFleet(1);
        input(leader(0), confirm(true));
        input(leader(1), confirm(true));
        assertEquals("BOMB", phase());
    }

    /** Both leaders pick and confirm, which resolves the round at once. */
    private void round(int[] shot0, int[] shot1) {
        input(leader(0), cell(shot0[0], shot0[1]));
        input(leader(1), cell(shot1[0], shot1[1]));
        input(leader(0), confirm(true));
        input(leader(1), confirm(true));
    }

    private void skipResult() {
        now += BuoyantBattleGame.RESULT_MS;
        game.onTick(now);
        assertEquals("BOMB", phase());
    }

    // ---- setup ----

    @Test
    void needsTwoPlayers() {
        game = new BuoyantBattleGame(new Random(1));
        PartyException ex = assertThrows(PartyException.class, () -> game.start(List.of(player("p1")), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", ex.getCode());
    }

    @Test
    void splitsTeamsEvenlyWithTheExtraOnARandomTeam() {
        Set<Integer> firstSizes = new HashSet<>();
        for (long seed = 0; seed < 20; seed++) {
            start(7, seed);
            int a = team(0).size();
            int b = team(1).size();
            assertEquals(7, a + b);
            assertTrue(Math.abs(a - b) == 1);
            firstSizes.add(a);
        }
        assertEquals(Set.of(3, 4), firstSizes);
        assertEquals("Kraken", host().path("teams").path(0).path("name").asText());
        assertEquals("violet", host().path("teams").path(1).path("color").asText());
    }

    @Test
    void twoPlayersSkipTheElection() {
        start(2);
        assertEquals("PLACE", phase());
        assertEquals(team(0).get(0), leader(0));
        assertEquals(team(1).get(0), leader(1));
    }

    @Test
    void singletonTeamGetsItsLeaderRightAway() {
        start(3);
        assertEquals("ELECTION", phase());
        int solo = team(0).size() == 1 ? 0 : 1;
        assertEquals(team(solo).get(0), leader(solo));
        assertThrows(IllegalArgumentException.class, () -> input(team(solo).get(0), target(team(solo).get(0).getId())));
    }

    // ---- election ----

    @Test
    void majorityWinsAndVotesCanChange() {
        start(6);
        List<Player> a = team(0);
        List<Player> b = team(1);
        input(a.get(0), target(a.get(1).getId()));
        input(a.get(1), target(a.get(1).getId()));
        input(a.get(2), target(a.get(0).getId()));
        input(a.get(2), target(a.get(1).getId())); // changed
        assertTrue(phone(a.get(2)).path("yourVote").asText().equals(a.get(1).getId()));
        input(b.get(0), target(b.get(2).getId()));
        input(b.get(1), target(b.get(2).getId()));
        assertEquals("ELECTION", phase());
        assertEquals(5, host().path("answeredIds").size());
        input(b.get(2), target(b.get(0).getId())); // last vote closes it early
        assertEquals("PLACE", phase());
        assertEquals(a.get(1), leader(0));
        assertEquals(b.get(2), leader(1));
    }

    @Test
    void canOnlyVoteForTeammates() {
        start(4);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> input(team(0).get(0), target(team(1).get(0).getId())));
        assertEquals("Vote for someone on your team", ex.getMessage());
    }

    @Test
    void tiesAreBrokenAtRandom() {
        Set<Boolean> firstVoterWon = new HashSet<>();
        for (long seed = 0; seed < 20; seed++) {
            start(4, seed);
            List<Player> a = team(0);
            input(a.get(0), target(a.get(0).getId()));
            input(a.get(1), target(a.get(1).getId()));
            game.onControl(action("closeVote"), now);
            assertTrue(a.contains(leader(0)));
            firstVoterWon.add(leader(0) == a.get(0));
        }
        assertEquals(2, firstVoterWon.size());
    }

    @Test
    void noVotesPicksAConnectedTeammateAtTheDeadline() {
        start(4);
        List<Player> a = team(0);
        a.get(0).setConnected(false);
        now += BuoyantBattleGame.ELECTION_MS - 1;
        assertFalse(game.onTick(now));
        now += 1;
        assertTrue(game.onTick(now));
        assertEquals("PLACE", phase());
        assertEquals(a.get(1), leader(0));
    }

    @Test
    void disconnectedPlayersDontHoldUpTheVote() {
        start(4);
        List<Player> a = team(0);
        List<Player> b = team(1);
        b.get(1).setConnected(false);
        input(a.get(0), target(a.get(0).getId()));
        input(a.get(1), target(a.get(0).getId()));
        input(b.get(0), target(b.get(0).getId()));
        assertEquals("PLACE", phase());
        assertThrows(IllegalArgumentException.class, () -> input(a.get(0), target(a.get(0).getId())));
    }

    // ---- placement ----

    @Test
    void placementRules() {
        start(4);
        game.onControl(action("closeVote"), now);
        Player l = leader(0);
        Player other = team(0).stream().filter(p -> p != l).findFirst().orElseThrow();

        assertEquals("Only your leader can do that",
                assertThrows(IllegalArgumentException.class, () -> input(other, place(0, 0, 0, false))).getMessage());
        assertEquals("That ship doesn't fit there",
                assertThrows(IllegalArgumentException.class, () -> input(l, place(0, 0, 3, false))).getMessage());
        assertEquals("Pick a square on the board",
                assertThrows(IllegalArgumentException.class, () -> input(l, place(0, 5, 0, false))).getMessage());
        assertEquals("Pick a ship",
                assertThrows(IllegalArgumentException.class, () -> input(l, place(3, 0, 0, false))).getMessage());

        input(l, place(0, 0, 0, false));
        assertEquals("Ships can't overlap",
                assertThrows(IllegalArgumentException.class, () -> input(l, place(1, 0, 2, true))).getMessage());
        input(l, place(0, 0, 1, false)); // moving a ship may overlap its own old squares
        input(l, place(0, 0, 0, true)); // rotate

        assertEquals("Place all 3 ships first",
                assertThrows(IllegalArgumentException.class, () -> input(l, confirm(true))).getMessage());
        input(l, place(1, 0, 1, false));
        input(l, place(2, 4, 3, false));
        input(l, confirm(true));
        assertTrue(host().path("teams").path(0).path("ready").asBoolean());
        input(l, place(2, 4, 2, false)); // changing the fleet clears ready
        assertFalse(host().path("teams").path(0).path("ready").asBoolean());

        JsonNode mine = phone(other).path("placement");
        assertEquals(3, mine.size());
        assertEquals(3, mine.path(0).path("cells").size());
        assertEquals(2, mine.path(0).path("cells").path(2).path("row").asInt()); // vertical: (0,0),(1,0),(2,0)
    }

    @Test
    void bothReadyStartsBombing() {
        start(4);
        toBombing();
        assertEquals(1, host().path("round").asInt());
    }

    @Test
    void randomizePlacesTheWholeFleet() {
        start(2);
        input(leader(0), GameTestSupport.json(Map.of("kind", "randomize")));
        input(leader(0), confirm(true));
        JsonNode ships = phone(leader(0)).path("placement");
        Set<String> cells = new HashSet<>();
        ships.forEach(s -> s.path("cells").forEach(c -> cells.add(c.path("row").asInt() + "," + c.path("col").asInt())));
        assertEquals(7, cells.size());
    }

    @Test
    void deadlineAutoPlacesUnplacedShips() {
        start(2);
        Player l0 = leader(0);
        input(l0, place(0, 0, 0, false));
        now += BuoyantBattleGame.PLACE_MS;
        game.onTick(now);
        assertEquals("BOMB", phase());
        game.onPlayerRemoved(leader(1)); // ends the game so the fleets are revealed
        assertEquals("FINAL", phase());
        JsonNode ships = host().path("teams").path(0).path("ships");
        // The placed ship stays where it was put: (0,0)-(0,2)
        assertEquals(0, ships.path(0).path("cells").path(2).path("row").asInt());
        assertEquals(2, ships.path(0).path("cells").path(2).path("col").asInt());
        Set<String> cells = new HashSet<>();
        ships.forEach(s -> s.path("cells").forEach(c -> cells.add(c.path("row").asInt() + "," + c.path("col").asInt())));
        assertEquals(7, cells.size());
    }

    @Test
    void hostCanEndPlacement() {
        start(2);
        game.onControl(action("endPlacement"), now);
        assertEquals("BOMB", phase());
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("endPlacement"), now));
    }

    // ---- bombing ----

    @Test
    void bombingRules() {
        start(4);
        toBombing();
        Player l0 = leader(0);
        Player other = team(0).stream().filter(p -> p != l0).findFirst().orElseThrow();
        assertThrows(IllegalArgumentException.class, () -> input(other, cell(1, 1)));
        assertEquals("Pick a square first",
                assertThrows(IllegalArgumentException.class, () -> input(l0, confirm(true))).getMessage());
        assertTrue(phone(other).path("target").isMissingNode());

        input(l0, cell(1, 1));
        assertEquals(1, phone(other).path("target").path("col").asInt()); // teammates see the highlight
        assertTrue(host().path("target").isMissingNode());
        assertTrue(phone(team(1).get(0)).path("target").isMissingNode());

        round(new int[] {0, 0}, new int[] {3, 3});
        assertEquals("RESULT", phase());
        JsonNode shots = host().path("lastResult").path("shots");
        assertTrue(shots.path(0).path("hit").asBoolean());
        assertFalse(shots.path(1).path("hit").asBoolean());
        assertEquals(1, host().path("teams").path(1).path("shots").size());

        skipResult();
        assertEquals(2, host().path("round").asInt());
        assertEquals("That square was already bombed",
                assertThrows(IllegalArgumentException.class, () -> input(leader(0), cell(0, 0))).getMessage());
    }

    @Test
    void confirmCanBeUndoneAndChangingTargetUnconfirms() {
        start(2);
        toBombing();
        input(leader(0), cell(1, 1));
        input(leader(0), confirm(true));
        assertTrue(host().path("teams").path(0).path("confirmed").asBoolean());
        input(leader(0), cell(1, 2));
        assertFalse(host().path("teams").path(0).path("confirmed").asBoolean());
        input(leader(0), confirm(true));
        input(leader(0), confirm(false));
        assertFalse(host().path("teams").path(0).path("confirmed").asBoolean());
    }

    @Test
    void deadlineUsesTheHighlightOrARandomOpenSquare() {
        start(2);
        toBombing();
        input(leader(0), cell(3, 4));
        now += BuoyantBattleGame.BOMB_MS;
        game.onTick(now);
        assertEquals("RESULT", phase());
        JsonNode shots = host().path("lastResult").path("shots");
        assertEquals(3, shots.path(0).path("row").asInt());
        assertEquals(4, shots.path(0).path("col").asInt());
        assertEquals(1, host().path("teams").path(0).path("shots").size()); // team 1 fired at random
        assertThrows(IllegalArgumentException.class, () -> input(leader(0), cell(2, 2))); // not BOMB any more
    }

    @Test
    void randomShotsNeverRepeatASquare() {
        start(2);
        toBombing();
        for (int i = 0; i < 6; i++) {
            now += BuoyantBattleGame.BOMB_MS;
            game.onTick(now);
            if (phase().equals("FINAL")) {
                break;
            }
            skipResult();
        }
        Set<String> seen = new HashSet<>();
        host().path("teams").path(0).path("shots").forEach(s -> assertTrue(seen.add(s.path("row").asInt() + "," + s.path("col").asInt())));
    }

    @Test
    void lateInputIsRejected() {
        start(2);
        toBombing();
        now += BuoyantBattleGame.BOMB_MS;
        assertEquals("Time's up", assertThrows(IllegalArgumentException.class, () -> input(leader(0), cell(1, 1))).getMessage());
    }

    @Test
    void nextSkipsTheResultPopupOnly() {
        start(2);
        toBombing();
        assertFalse(game.onAdvance(now));
        round(WATER[0], WATER[0]);
        assertTrue(game.onAdvance(now));
        assertEquals("BOMB", phase());
    }

    // ---- winning ----

    @Test
    void sinkingTheWholeFleetWinsAndPaysHalfThePlayerCount() {
        start(5);
        int[] before = players.stream().mapToInt(Player::getScore).toArray();
        toBombing();
        for (int i = 0; i < FLEET.length; i++) {
            round(FLEET[i], WATER[i]);
            JsonNode shot = host().path("lastResult").path("shots").path(0);
            assertTrue(shot.path("hit").asBoolean());
            assertEquals(i == 2 || i == 4 || i == 6, shot.path("sunk").asBoolean());
            if (i < FLEET.length - 1) {
                assertEquals("RESULT", phase());
                skipResult();
            }
        }
        assertEquals("FINAL", phase());
        assertTrue(game.isFinished());
        JsonNode h = host();
        assertEquals(List.of(0), toList(h.path("winners")));
        assertEquals(0, h.path("teams").path(1).path("shipsLeft").asInt());
        assertEquals(3, h.path("teams").path(1).path("sunk").size());
        assertEquals(3, h.path("teams").path(0).path("shipsLeft").asInt());
        assertEquals(2, h.path("pointsEach").asInt());
        for (int i = 0; i < players.size(); i++) {
            Player p = players.get(i);
            int expected = team(0).contains(p) ? 2 : 0;
            assertEquals(expected, p.getScore() - before[i]);
        }
        assertEquals(2, h.path("standings").path(0).path("points").asInt());
        assertTrue(h.path("teams").path(0).path("ships").size() == 3); // fleets revealed
    }

    @Test
    void sinkingEachOtherInTheSameRoundIsADraw() {
        start(2);
        toBombing();
        for (int i = 0; i < FLEET.length; i++) {
            round(FLEET[i], FLEET[i]);
            if (i < FLEET.length - 1) {
                skipResult();
            }
        }
        assertEquals("FINAL", phase());
        assertEquals(List.of(0, 1), toList(host().path("winners")));
        players.forEach(p -> assertEquals(1, p.getScore()));
    }

    private static List<Integer> toList(JsonNode array) {
        List<Integer> list = new ArrayList<>();
        array.forEach(n -> list.add(n.asInt()));
        return list;
    }

    // ---- leaders ----

    @Test
    void disconnectedLeaderIsReplacedWhenARoundStarts() {
        start(4);
        game.onControl(action("closeVote"), now);
        Player old = leader(0);
        placeFleet(0);
        placeFleet(1);
        old.setConnected(false);
        assertEquals(old, leader(0)); // not mid-phase
        game.onControl(action("endPlacement"), now);
        assertNotEquals(old, leader(0));
        assertTrue(team(0).contains(leader(0)));

        Player second = leader(0);
        old.setConnected(true);
        round(WATER[0], WATER[0]);
        second.setConnected(false);
        skipResult();
        assertEquals(old, leader(0));
    }

    @Test
    void handoffTakesEffectNextRound() {
        start(4);
        toBombing();
        Player l = leader(0);
        Player mate = team(0).stream().filter(p -> p != l).findFirst().orElseThrow();
        assertEquals("Only your leader can do that",
                assertThrows(IllegalArgumentException.class, () -> input(mate, handoff(l.getId()))).getMessage());
        assertEquals("Pick a teammate",
                assertThrows(IllegalArgumentException.class, () -> input(l, handoff(team(1).get(0).getId()))).getMessage());

        input(l, handoff(mate.getId()));
        assertEquals(mate.getId(), phone(l).path("pendingLeaderId").asText());
        assertEquals(mate.getId(), phone(mate).path("pendingLeaderId").asText());
        assertTrue(phone(team(1).get(0)).path("pendingLeaderId").isMissingNode());
        assertEquals(l, leader(0)); // still acts this round
        round(WATER[0], WATER[0]);
        assertEquals(l, leader(0));
        skipResult();
        assertEquals(mate, leader(0));
        assertTrue(phone(mate).path("isLeader").asBoolean());
        assertTrue(phone(mate).path("pendingLeaderId").isMissingNode());
    }

    @Test
    void handoffCanBeCancelled() {
        start(4);
        toBombing();
        Player l = leader(0);
        Player mate = team(0).stream().filter(p -> p != l).findFirst().orElseThrow();
        input(l, handoff(mate.getId()));
        input(l, handoff(null));
        round(WATER[0], WATER[0]);
        skipResult();
        assertEquals(l, leader(0));
    }

    @Test
    void handoffMadeWhilePlacingAppliesAtTheFirstRound() {
        start(4);
        game.onControl(action("closeVote"), now);
        Player l = leader(0);
        Player mate = team(0).stream().filter(p -> p != l).findFirst().orElseThrow();
        input(l, handoff(mate.getId()));
        input(l, place(0, 0, 0, false)); // the old leader still places
        game.onControl(action("endPlacement"), now);
        assertEquals(mate, leader(0));
    }

    @Test
    void handoffToADisconnectedTeammateFallsBackToARandomConnectedOne() {
        start(6);
        game.onControl(action("closeVote"), now);
        Player l = leader(0);
        Player mate = team(0).stream().filter(p -> p != l).findFirst().orElseThrow();
        input(l, handoff(mate.getId()));
        mate.setConnected(false);
        game.onControl(action("endPlacement"), now);
        assertNotEquals(mate, leader(0));
        assertTrue(leader(0).isConnected());
    }

    // ---- pause ----

    @Test
    void pauseFreezesTheClockAndEarlyEnds() {
        start(2);
        toBombing();
        now += 10_000;
        game.onControl(action("pause"), now);
        JsonNode h = host();
        assertTrue(h.path("paused").asBoolean());
        assertEquals(BuoyantBattleGame.BOMB_MS - 10_000, h.path("remainingMs").asLong());
        assertTrue(h.path("deadline").isMissingNode());
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("pause"), now));

        now += 100_000;
        assertFalse(game.onTick(now));
        input(leader(0), cell(1, 1)); // inputs still work
        input(leader(0), confirm(true));
        input(leader(1), cell(1, 1));
        input(leader(1), confirm(true));
        assertEquals("BOMB", phase()); // waits for resume

        game.onControl(action("resume"), now);
        assertEquals("RESULT", phase());
    }

    @Test
    void resumeContinuesWithTheRemainingTime() {
        start(2);
        toBombing();
        now += 10_000;
        game.onControl(action("pause"), now);
        now += 50_000;
        game.onControl(action("resume"), now);
        assertEquals(now + BuoyantBattleGame.BOMB_MS - 10_000, host().path("deadline").asLong());
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("resume"), now));
    }

    // ---- kicks ----

    @Test
    void kickedLeaderIsReplacedAtOnce() {
        start(4);
        toBombing();
        Player l = leader(0);
        game.onPlayerRemoved(l);
        assertTrue(team(0).size() == 1);
        assertEquals(team(0).get(0), leader(0));
        assertEquals("BOMB", phase());
    }

    @Test
    void kickDropsVotesForAndByThePlayer() {
        start(6);
        List<Player> a = team(0);
        input(a.get(0), target(a.get(2).getId()));
        input(a.get(1), target(a.get(2).getId()));
        input(a.get(2), target(a.get(0).getId()));
        game.onPlayerRemoved(a.get(2));
        assertEquals(0, host().path("teams").path(0).path("votedIds").size()); // a2's vote and both votes for a2 are gone
        game.onControl(action("closeVote"), now);
        assertTrue(team(0).contains(leader(0)));
    }

    @Test
    void emptiedTeamLoses() {
        start(3);
        int solo = team(0).size() == 1 ? 0 : 1;
        Player loner = team(solo).get(0);
        game.onPlayerRemoved(loner);
        assertEquals("FINAL", phase());
        assertEquals(List.of(1 - solo), toList(host().path("winners")));
        team(1 - solo).forEach(p -> assertEquals(1, p.getScore()));
    }

    // ---- privacy ----

    @Test
    void fleetsAndTargetsStaySecret() {
        start(4);
        game.onControl(action("closeVote"), now);
        placeFleet(0);
        String hostJson = host().toString();
        assertFalse(hostJson.contains("placement"));
        assertFalse(hostJson.contains("\"ships\""));
        JsonNode enemy = phone(team(1).get(0));
        // Team 1 sees only its own (still unplaced) fleet
        enemy.path("placement").forEach(s -> assertEquals(0, s.path("cells").size()));
        assertFalse(enemy.toString().contains("\"ships\""));

        placeFleet(1);
        input(leader(0), confirm(true));
        input(leader(1), confirm(true));
        assertTrue(phone(team(0).get(0)).path("placement").isMissingNode()); // not shown again until the end
        assertFalse(host().toString().contains("\"ships\""));
    }
}
