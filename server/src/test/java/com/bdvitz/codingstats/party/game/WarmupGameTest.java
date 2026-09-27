package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.bdvitz.codingstats.party.game.GameTestSupport.choice;
import static com.bdvitz.codingstats.party.game.GameTestSupport.json;
import static com.bdvitz.codingstats.party.game.GameTestSupport.number;
import static com.bdvitz.codingstats.party.game.GameTestSupport.player;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WarmupGameTest {

    private WarmupGame game;
    private Player a;
    private Player b;
    private Player c;

    @BeforeEach
    void setUp() {
        game = new WarmupGame();
        a = player("p1");
        b = player("p2");
        c = player("p3");
        game.start(List.of(a, b, c), 0);
    }

    private String phase() {
        return json(game.hostView()).path("phase").asText();
    }

    @Test
    void fullGameFlowScoresMajorityAndClosestGuess() {
        assertEquals("POLL", phase());
        game.onInput(a, choice(0), 1);
        game.onInput(b, choice(0), 1);
        assertEquals("POLL", phase(), "waits for everyone connected");
        game.onInput(c, choice(1), 1);
        assertEquals("POLL_REVEAL", phase(), "reveals early once everyone answered");
        assertEquals(2, json(game.hostView()).path("tally").get(0).asInt());

        assertTrue(game.onAdvance(2));
        assertEquals("GUESS", phase());
        // Every guess question's answer is < 2000, so 100 is always closer than 1,000,000
        game.onInput(a, number("100"), 3);
        game.onInput(b, number("1000000"), 3);
        game.onInput(c, number("1000000"), 3);
        assertEquals("GUESS_REVEAL", phase());

        game.onAdvance(4);
        assertTrue(game.isFinished());
        assertEquals(3, a.getScore(), "majority (1) + closest guess (2)");
        assertEquals(1, b.getScore());
        assertEquals(0, c.getScore());
        JsonNode standings = json(game.hostView()).path("standings");
        assertEquals("p1", standings.get(0).path("playerId").asText());
    }

    @Test
    void deadlineRevealsWithoutAnswersAndScoresNobody() {
        assertFalse(game.onTick(19_999));
        assertTrue(game.onTick(20_000));
        assertEquals("POLL_REVEAL", phase());
        assertEquals(0, a.getScore() + b.getScore() + c.getScore());
    }

    @Test
    void disconnectedPlayersDoNotBlockEarlyReveal() {
        c.setConnected(false);
        game.onInput(a, choice(0), 1);
        game.onInput(b, choice(1), 1);
        assertEquals("POLL_REVEAL", phase());
    }

    @Test
    void playerViewsDoNotLeakOtherPlayersAnswers() {
        game.onInput(a, choice(1), 1);
        assertEquals(1, json(game.playerView(a)).path("yourChoice").asInt());
        assertTrue(json(game.playerView(b)).path("yourChoice").isMissingNode());
        assertEquals(1, json(game.hostView()).path("answeredIds").size(), "host sees who answered, not what");
    }

    @Test
    void invalidInputThrowsAndLateInputIsIgnored() {
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, choice(9), 1));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("5"), 1), "number during poll");
        game.onTick(20_000);
        assertFalse(game.onInput(a, choice(0), 20_001), "answers after the reveal are ignored");
        game.onAdvance(20_002);
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("-5"), 20_003));
        assertThrows(IllegalArgumentException.class, () -> game.onInput(a, number("abc"), 20_003));
    }

    @Test
    void answersCanBeChangedBeforeTheDeadline() {
        // Polls have 2-4 options, so only indexes 0 and 1 are always valid
        game.onInput(a, choice(0), 1);
        game.onInput(a, choice(1), 2);
        assertEquals(1, json(game.playerView(a)).path("yourChoice").asInt());
        game.onInput(b, choice(1), 3);
        game.onInput(c, choice(0), 3);
        JsonNode tally = json(game.hostView()).path("tally");
        assertEquals(1, tally.get(0).asInt(), "the replaced answer no longer counts");
        assertEquals(2, tally.get(1).asInt());
    }

    @Test
    void removedPlayerIsDroppedFromTheGame() {
        game.onPlayerRemoved(c);
        game.onInput(a, choice(0), 1);
        game.onInput(b, choice(0), 1);
        assertEquals("POLL_REVEAL", phase(), "no longer waits for the kicked player");
        assertEquals(2, json(game.hostView()).path("tally").get(0).asInt());
    }
}
