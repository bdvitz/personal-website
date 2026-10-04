package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.IntStream;

import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.number;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CardConundrumGameTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private CardConundrumGame game;
    private List<Player> players;
    private long now;

    private void start(int n) {
        game = new CardConundrumGame(new Random(42));
        players = IntStream.rangeClosed(1, n).mapToObj(i -> player("p" + i)).toList();
        game.start(players, 0);
        now = 0;
    }

    private static JsonNode action(String name) {
        return MAPPER.createObjectNode().put("action", name);
    }

    private static JsonNode eliminate(String playerId) {
        ObjectNode node = MAPPER.createObjectNode().put("action", "eliminate");
        if (playerId != null) {
            node.put("playerId", playerId);
        }
        return node;
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    private String phase() {
        return host().path("phase").asText();
    }

    /** startRound, then let the countdown run out. */
    private void playToCards() {
        game.onControl(action("startRound"), now);
        now += CardConundrumGame.COUNTDOWN_MS;
        game.onTick(now);
        assertEquals("CARDS", phase());
    }

    private List<String> cardsShown() {
        List<String> cards = new ArrayList<>();
        host().path("groups").forEach(g -> cards.add(g.path("card").path("rank").asText() + g.path("card").path("suit").asText()));
        return cards;
    }

    @Test
    void needsTwoPlayers() {
        game = new CardConundrumGame(new Random(1));
        PartyException ex = assertThrows(PartyException.class, () -> game.start(List.of(player("p1")), 0));
        assertEquals("NOT_ENOUGH_PLAYERS", ex.getCode());
    }

    @Test
    void groupCountFollowsTheFormula() {
        assertEquals(1, CardConundrumGame.groupCount(2));
        assertEquals(1, CardConundrumGame.groupCount(3));
        assertEquals(2, CardConundrumGame.groupCount(4));
        assertEquals(2, CardConundrumGame.groupCount(6));
        assertEquals(3, CardConundrumGame.groupCount(7));
        assertEquals(6, CardConundrumGame.groupCount(16));
    }

    @Test
    void groupsAreEvenAtMostThreeAndCoverEveryone() {
        for (int n = 2; n <= 16; n++) {
            start(n);
            playToCards();
            JsonNode groups = host().path("groups");
            assertEquals((n + 2) / 3, groups.size(), "K for n=" + n);
            int min = Integer.MAX_VALUE;
            int max = 0;
            Set<String> seen = new HashSet<>();
            for (JsonNode g : groups) {
                int size = g.path("players").size();
                min = Math.min(min, size);
                max = Math.max(max, size);
                g.path("players").forEach(p -> assertTrue(seen.add(p.path("playerId").asText()), "one group each"));
            }
            assertTrue(max <= 3, "max 3 for n=" + n);
            assertTrue(max - min <= 1, "even sizes for n=" + n);
            assertEquals(n, seen.size());
            assertEquals(new HashSet<>(cardsShown()).size(), cardsShown().size(), "distinct cards for n=" + n);
        }
    }

    @Test
    void startsReadyAndHidesCardsDuringTheCountdown() {
        start(5);
        assertEquals("READY", phase());
        assertTrue(host().path("groups").isMissingNode());
        game.onControl(action("startRound"), 100);
        assertEquals("COUNTDOWN", phase());
        assertEquals(100 + CardConundrumGame.COUNTDOWN_MS, host().path("deadline").asLong());
        assertTrue(host().path("groups").isMissingNode(), "no peeking");
        assertTrue(json(game.playerView(players.get(0))).path("yourGroupIndex").isMissingNode());
        assertFalse(game.onTick(100 + CardConundrumGame.COUNTDOWN_MS - 1));
        assertTrue(game.onTick(100 + CardConundrumGame.COUNTDOWN_MS));
        assertEquals("CARDS", phase());
        JsonNode mine = json(game.playerView(players.get(0)));
        int index = mine.path("yourGroupIndex").asInt();
        boolean found = false;
        for (JsonNode p : host().path("groups").get(index).path("players")) {
            found |= p.path("playerId").asText().equals("p1");
        }
        assertTrue(found, "yourGroupIndex points at your group");
    }

    @Test
    void controlsOnlyWorkInTheirPhase() {
        start(4);
        assertThrows(IllegalArgumentException.class, () -> game.onControl(eliminate("p1"), now));
        game.onControl(action("startRound"), now);
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("startRound"), now));
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("endGame"), now));
        assertThrows(IllegalArgumentException.class, () -> game.onControl(eliminate(null), now), "not during countdown");
        assertThrows(IllegalArgumentException.class, () -> game.onControl(action("dance"), now));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(players.get(0), number("1"), now));
    }

    @Test
    void eliminatingPaysSurvivorsAndAnnouncesTheLoser() {
        start(4);
        playToCards();
        assertThrows(IllegalArgumentException.class, () -> game.onControl(eliminate("p9"), now));
        game.onControl(eliminate("p2"), now);
        assertEquals("RESULT", phase());
        assertEquals("p2", host().path("lastResult").path("eliminated").path("playerId").asText());
        assertEquals(3, host().path("alive").size());
        assertEquals(1, host().path("eliminated").get(0).path("round").asInt());
        assertEquals(0, players.get(1).getScore());
        assertEquals(1, players.get(0).getScore());
        assertTrue(json(game.playerView(players.get(1))).path("out").asBoolean());
        assertFalse(json(game.playerView(players.get(0))).path("out").asBoolean());

        playToCards();
        assertEquals(2, host().path("round").asInt());
        assertEquals(1, host().path("groups").size(), "3 left -> K=1");
        assertThrows(IllegalArgumentException.class, () -> game.onControl(eliminate("p2"), now), "already out");
    }

    @Test
    void tieEliminatesNobodyButStillPays() {
        start(3);
        playToCards();
        game.onControl(eliminate(null), now);
        assertEquals("RESULT", phase());
        assertTrue(host().path("lastResult").path("eliminated").isMissingNode());
        assertEquals(3, host().path("alive").size());
        players.forEach(p -> assertEquals(1, p.getScore()));
    }

    @Test
    void lastPlayerStandingWinsWithBonus() {
        start(3);
        playToCards();
        game.onControl(eliminate("p1"), now); // p2, p3 +1
        playToCards();
        game.onControl(eliminate("p2"), now); // p3 +1, then +3
        assertTrue(game.isFinished());
        assertEquals("p3", host().path("winner").path("playerId").asText());
        assertEquals(5, players.get(2).getScore());
        assertEquals(1, players.get(1).getScore());
        assertEquals(0, players.get(0).getScore());
        JsonNode standings = host().path("standings");
        assertEquals(List.of("p3", "p2", "p1"), List.of(standings.get(0).path("playerId").asText(),
                standings.get(1).path("playerId").asText(), standings.get(2).path("playerId").asText()));
        assertEquals(5, standings.get(0).path("points").asInt());
        assertEquals("p2", host().path("lastResult").path("eliminated").path("playerId").asText(), "final elimination shown");
    }

    @Test
    void endGameEarlyGivesNoBonus() {
        start(4);
        playToCards();
        game.onControl(eliminate("p4"), now);
        game.onControl(action("endGame"), now);
        assertTrue(game.isFinished());
        assertTrue(host().path("winner").isMissingNode());
        assertEquals(1, players.get(0).getScore());
        assertEquals(4, host().path("standings").size());
    }

    @Test
    void cardsDontRepeatUntilThePileRunsOutThenReshuffleSkipsLastRound() {
        start(16); // K = 6 per round
        Set<String> seen = new HashSet<>();
        for (int r = 0; r < 8; r++) { // 8 * 6 = 48 cards, all from one pile
            playToCards();
            for (String c : cardsShown()) {
                assertTrue(seen.add(c), "no repeat before reshuffle: " + c);
            }
            game.onControl(eliminate(null), now);
        }
        assertEquals(4, game.pileSize());
        List<String> previous = cardsShown();
        playToCards(); // needs 6, only 4 left -> reshuffle
        for (String c : cardsShown()) {
            assertFalse(previous.contains(c), "last round's cards are left out of the reshuffle");
        }
        assertEquals(52 - 6 - 6, game.pileSize());
    }

    @Test
    void kickedPlayersLeaveTheirGroupAndCanHandTheWin() {
        start(4); // K=2, two groups of 2
        playToCards();
        Player kicked = players.get(0);
        game.onPlayerRemoved(kicked);
        int total = 0;
        for (JsonNode g : host().path("groups")) {
            total += g.path("players").size();
            g.path("players").forEach(p -> assertFalse(p.path("playerId").asText().equals("p1")));
        }
        assertEquals(3, total);
        game.onControl(eliminate("p2"), now);
        game.onPlayerRemoved(players.get(2));
        assertTrue(game.isFinished(), "one left after the kick");
        assertEquals("p4", host().path("winner").path("playerId").asText());
    }
}
