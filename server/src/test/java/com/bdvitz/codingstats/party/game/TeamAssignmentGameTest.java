package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.IntStream;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TeamAssignmentGameTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private TeamAssignmentGame game;
    private List<Player> players;

    private void start(int n) {
        game = new TeamAssignmentGame(new Random(42));
        players = IntStream.rangeClosed(1, n).mapToObj(i -> player("p" + i)).toList();
        game.start(players, 0);
    }

    private static JsonNode action(String name) {
        return MAPPER.createObjectNode().put("action", name);
    }

    private static JsonNode assign(int k) {
        return MAPPER.createObjectNode().put("action", "assign").put("k", k);
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    private List<Integer> teamSizes() {
        List<Integer> sizes = new ArrayList<>();
        host().path("teams").forEach(t -> sizes.add(t.path("players").size()));
        return sizes;
    }

    private List<String> letters() {
        List<String> letters = new ArrayList<>();
        host().path("teams").forEach(t -> letters.add(t.path("letter").asText()));
        return letters;
    }

    private String rosterSignature() {
        StringBuilder sb = new StringBuilder();
        host().path("teams").forEach(t -> {
            t.path("players").forEach(p -> sb.append(p.path("playerId").asText()).append(','));
            sb.append('|');
        });
        return sb.toString();
    }

    @Test
    void needsTwoPlayers() {
        game = new TeamAssignmentGame(new Random(1));
        PartyException ex = assertThrows(PartyException.class, () -> game.start(List.of(player("p1")), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", ex.getCode());
    }

    @Test
    void teamCountIsCeilingOfPlayersOverK() {
        assertEquals(1, TeamAssignmentGame.teamCount(2, 2));
        assertEquals(2, TeamAssignmentGame.teamCount(3, 2));
        assertEquals(4, TeamAssignmentGame.teamCount(13, 4));
        assertEquals(2, TeamAssignmentGame.teamCount(16, 8));
        assertEquals(1, TeamAssignmentGame.teamCount(5, 8));
    }

    @Test
    void startsWaitingForK() {
        start(5);
        assertEquals("PICK", host().path("phase").asText());
        assertEquals(5, host().path("playerCount").asInt());
        assertTrue(host().path("teams").isMissingNode());
        assertTrue(host().path("k").isMissingNode());
    }

    @Test
    void assignSplitsEvenlyWithAtMostKAndLettersFromA() {
        for (int n = 2; n <= 16; n++) {
            for (int k = TeamAssignmentGame.MIN_K; k <= TeamAssignmentGame.MAX_K; k++) {
                start(n);
                game.onControl(assign(k), 0);
                List<Integer> sizes = teamSizes();
                assertEquals(TeamAssignmentGame.teamCount(n, k), sizes.size(), "n=" + n + " k=" + k);
                assertEquals(n, sizes.stream().mapToInt(Integer::intValue).sum());
                int max = sizes.stream().mapToInt(Integer::intValue).max().orElseThrow();
                int min = sizes.stream().mapToInt(Integer::intValue).min().orElseThrow();
                assertTrue(max <= k, "no team over k");
                assertTrue(max - min <= 1, "sizes within 1");
                for (int i = 0; i < sizes.size(); i++) {
                    assertEquals(String.valueOf((char) ('A' + i)), letters().get(i));
                }
            }
        }
    }

    @Test
    void everyPlayerIsOnExactlyOneTeam() {
        start(7);
        game.onControl(assign(3), 0);
        Set<String> seen = new HashSet<>();
        host().path("teams").forEach(t -> t.path("players").forEach(p -> assertTrue(seen.add(p.path("playerId").asText()))));
        assertEquals(7, seen.size());
    }

    @Test
    void rejectsBadK() {
        start(4);
        assertThrows(IllegalArgumentException.class, () -> game.onControl(assign(1), 0));
        assertThrows(IllegalArgumentException.class, () -> game.onControl(assign(9), 0));
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("assign"), 0), "missing k");
        assertThrows(IllegalArgumentException.class,
                () -> game.onControl(MAPPER.createObjectNode().put("action", "assign").put("k", "3"), 0), "k must be a number");
        assertEquals("PICK", host().path("phase").asText());
    }

    @Test
    void controlsAreCheckedAgainstThePhase() {
        start(4);
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("reroll"), 0));
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("changeSize"), 0));
        game.onControl(assign(2), 0);
        assertThrows(IllegalArgumentException.class, () -> game.onControl(assign(3), 0), "change size first");
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("dance"), 0));
    }

    @Test
    void rerollKeepsKAndReshuffles() {
        start(10);
        game.onControl(assign(3), 0);
        String before = rosterSignature();
        boolean changed = false;
        for (int i = 0; i < 5 && !changed; i++) {
            game.onControl(action("reroll"), 0);
            changed = !rosterSignature().equals(before);
        }
        assertTrue(changed, "a reroll reshuffles");
        assertEquals(3, host().path("k").asInt());
        assertEquals(List.of(3, 3, 2, 2), teamSizes());
    }

    @Test
    void changeSizeReturnsToPickerRememberingK() {
        start(6);
        game.onControl(assign(3), 0);
        game.onControl(action("changeSize"), 0);
        assertEquals("PICK", host().path("phase").asText());
        assertEquals(3, host().path("k").asInt());
        assertTrue(host().path("teams").isMissingNode());
        game.onControl(assign(2), 0);
        assertEquals(List.of(2, 2, 2), teamSizes());
    }

    @Test
    void exitFinishesAndReturnsToLobby() {
        start(3);
        assertTrue(game.returnsToLobby());
        assertFalse(game.isFinished());
        game.onControl(action("exit"), 0);
        assertTrue(game.isFinished());

        start(3);
        game.onControl(assign(2), 0);
        game.onControl(action("exit"), 0);
        assertTrue(game.isFinished(), "exit works from TEAMS too");
    }

    @Test
    void noPointsAndNoPlayerInput() {
        start(4);
        game.onControl(assign(2), 0);
        assertThrows(IllegalArgumentException.class, () -> game.onInput(players.get(0), choice(0), 0));
        assertFalse(game.onTick(Long.MAX_VALUE));
        assertFalse(game.onAdvance(0));
        game.onControl(action("exit"), 0);
        players.forEach(p -> assertEquals(0, p.getScore()));
    }

    @Test
    void phoneGetsItsOwnTeamIndex() {
        start(5);
        assertTrue(json(game.playerView(players.get(0))).path("yourTeamIndex").isMissingNode());
        game.onControl(assign(2), 0);
        for (Player p : players) {
            JsonNode view = json(game.playerView(p));
            JsonNode team = view.path("teams").get(view.path("yourTeamIndex").asInt());
            boolean found = false;
            for (JsonNode member : team.path("players")) {
                found |= member.path("playerId").asText().equals(p.getId());
            }
            assertTrue(found, p.getId() + " is on the team its index points at");
        }
    }

    @Test
    void kickLeavesOthersInPlaceAndDropsEmptyTeamsKeepingLetters() {
        start(3);
        game.onControl(assign(2), 0); // A has 2, B has 1
        assertEquals(List.of(2, 1), teamSizes());
        Player loneB = players.stream()
                .filter(p -> host().path("teams").get(1).path("players").get(0).path("playerId").asText().equals(p.getId()))
                .findFirst().orElseThrow();
        String teamA = host().path("teams").get(0).toString();

        game.onPlayerRemoved(loneB);
        assertEquals(List.of("A"), letters());
        assertEquals(teamA, host().path("teams").get(0).toString(), "team A untouched");
        assertEquals(2, host().path("playerCount").asInt());

        // A later reroll only uses the remaining players
        game.onControl(action("reroll"), 0);
        assertEquals(List.of(2), teamSizes());
    }

    @Test
    void kickRemovingMiddleTeamKeepsLaterLetters() {
        start(5);
        game.onControl(assign(2), 0); // A 2, B 2, C 1
        List<String> bIds = new ArrayList<>();
        host().path("teams").get(1).path("players").forEach(p -> bIds.add(p.path("playerId").asText()));
        players.stream().filter(p -> bIds.contains(p.getId())).toList().forEach(game::onPlayerRemoved);
        assertEquals(List.of("A", "C"), letters());
        assertEquals(List.of(2, 1), teamSizes());
    }
}
