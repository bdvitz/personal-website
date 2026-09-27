package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static com.bdvitz.codingstats.party.game.GameTestSupport.target;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class MostLikelyGameTest {

    private MostLikelyGame game;
    private Player a;
    private Player b;
    private Player c;

    @BeforeEach
    void setUp() {
        game = new MostLikelyGame();
        a = player("p1");
        b = player("p2");
        c = player("p3");
        game.start(List.of(a, b, c), 0);
    }

    private JsonNode host() {
        return json(game.hostView());
    }

    @Test
    void votingRoundScoresPlayersWhoPickedTheTopChoice() {
        assertEquals("VOTE", host().path("phase").asText());
        assertEquals(3, host().path("candidates").size());
        game.onInput(a, target("p3"), 1);
        game.onInput(b, target("p3"), 1);
        game.onInput(c, target("p1"), 1);
        assertEquals("REVEAL", host().path("phase").asText());
        JsonNode results = host().path("results");
        assertEquals("p3", results.get(0).path("playerId").asText());
        assertEquals(2, results.get(0).path("votes").asInt());
        assertTrue(results.get(0).path("top").asBoolean());
        assertEquals(1, a.getScore());
        assertEquals(1, b.getScore());
        assertEquals(0, c.getScore());
        assertTrue(json(game.playerView(a)).path("youScored").asBoolean());
    }

    @Test
    void runsThreeRoundsWithDifferentPromptsThenFinishes() {
        String firstPrompt = host().path("prompt").asText();
        for (int round = 1; round <= MostLikelyGame.ROUNDS; round++) {
            assertEquals(round, host().path("round").asInt());
            game.onInput(a, target("p2"), round);
            assertEquals("p2", json(game.playerView(a)).path("yourVote").asText());
            assertTrue(game.onTick(round * 100_000L), "deadline reveals");
            assertFalse(game.isFinished());
            game.onAdvance(round * 100_000L + 1);
            if (round == 1) {
                assertNotEquals(firstPrompt, host().path("prompt").asText());
                assertTrue(json(game.playerView(a)).path("yourVote").isMissingNode(), "votes reset each round");
            }
        }
        assertTrue(game.isFinished());
        assertEquals(3, a.getScore(), "sole voter picks the top choice every round");
        assertEquals(3, host().path("standings").size());
    }

    @Test
    void rejectsSelfVotesUnknownPlayersAndWrongInputKinds() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, target("p1"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, target("p99"), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, choice(0), 1));
    }

    @Test
    void soloPlayerMayVoteForThemselves() {
        MostLikelyGame solo = new MostLikelyGame();
        Player only = player("p1");
        solo.start(List.of(only), 0);
        solo.onInput(only, target("p1"), 1);
        assertEquals("REVEAL", json(solo.hostView()).path("phase").asText());
        assertEquals(1, only.getScore());
    }

    @Test
    void hostViewShowsWhoVotedButNotForWhom() {
        game.onInput(a, target("p3"), 1);
        JsonNode view = host();
        assertEquals(1, view.path("answeredIds").size());
        assertFalse(view.toString().contains("\"yourVote\""));
        assertTrue(json(game.playerView(b)).path("yourVote").isMissingNode());
    }

    @Test
    void removingAPlayerDropsVotesForAndByThem() {
        game.onInput(a, target("p3"), 1);
        game.onInput(c, target("p1"), 1);
        game.onPlayerRemoved(c);
        assertTrue(json(game.playerView(a)).path("yourVote").isMissingNode(), "a voted for the kicked player, so must re-vote");
        assertEquals(2, host().path("candidates").size());
        game.onInput(b, target("p1"), 1);
        assertEquals("VOTE", host().path("phase").asText(), "still waiting on a");
        game.onInput(a, target("p2"), 1);
        assertEquals("REVEAL", host().path("phase").asText());
        JsonNode results = host().path("results");
        assertEquals(2, results.size());
        for (JsonNode row : results) {
            assertEquals(1, row.path("votes").asInt(), "c's vote for p1 was removed");
        }
    }
}
