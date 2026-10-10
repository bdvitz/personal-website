package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

/**
 * Contract every party game implements. One instance runs one game in one room.
 *
 * All methods are called while holding the room's lock, so implementations need no
 * synchronization. Methods returning boolean report whether the state changed (which
 * triggers a broadcast). Times are epoch millis from the server clock.
 *
 * Inactive and disconnected players are the game's responsibility: phases should have
 * deadlines, enforced in {@link #onTick}, that apply a default for anyone who didn't act.
 * {@link Player#isConnected()} is available for "everyone connected has answered" checks.
 */
public interface PartyGame {

    /** Registry id, also sent to the client to pick the matching views. */
    String id();

    /**
     * Called before {@link #start} with the lobby-chosen options (see {@link GameRegistry#resolve}),
     * already validated and filled with defaults. Games without options ignore it.
     */
    default void configure(Map<String, Integer> options) {}

    /** Called once with the seated players (fixed for the whole game). */
    void start(List<Player> players, long now);

    /**
     * Handle a player's input payload ({@code {kind:"choice"|"number"|"target", ...}},
     * see {@link PartyInputs}). Throw IllegalArgumentException for invalid input; the
     * message is shown to that player.
     */
    boolean onInput(Player player, JsonNode input, long now);

    /** Called every ~250ms; enforce phase deadlines here. */
    boolean onTick(long now);

    /** Host or VIP pressed "Next" (skip a timer or leave a reveal screen). */
    boolean onAdvance(long now);

    /**
     * Host or VIP sent a game-specific action ({@code control{action}}, e.g. {@code {action:"eliminate", playerId}}).
     * Throw IllegalArgumentException for an invalid or ill-timed action; the message is shown to the sender.
     */
    default boolean onControl(JsonNode action, long now) {
        throw new IllegalArgumentException("Unexpected action");
    }

    /** A player was kicked from the room mid-game. */
    default void onPlayerRemoved(Player player) {}

    /**
     * True for games with private scores: while this game runs, room state omits every player's
     * score (TV included) and each phone only gets its own score in {@code you.score}.
     */
    default boolean hidesScores() {
        return false;
    }

    /**
     * True for games with nothing to show once they end (e.g. no scores): finishing skips GAME_OVER and
     * goes straight back to the lobby, seating waiting players like {@code backToLobby}.
     */
    default boolean returnsToLobby() {
        return false;
    }

    /** Payload for the TV screen. Must be JSON-serializable. */
    Object hostView();

    /** Payload for one player's phone. Must not leak other players' secret choices. */
    Object playerView(Player player);

    boolean isFinished();
}
