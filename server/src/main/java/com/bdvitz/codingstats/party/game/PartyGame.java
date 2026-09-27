package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;

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

    /** Called once with the seated players (fixed for the whole game). */
    void start(List<Player> players, long now);

    /**
     * Handle a player's input payload ({@code {kind:"choice"|"number"|"target", ...}},
     * see {@link PartyInputs}). Throw IllegalArgumentException for invalid input; the
     * message is shown to that player.
     */
    boolean onInput(Player player, JsonNode input, long now);

    /** Called about once a second; enforce phase deadlines here. */
    boolean onTick(long now);

    /** Host or VIP pressed "Next" (skip a timer or leave a reveal screen). */
    boolean onAdvance(long now);

    /** A player was kicked from the room mid-game. */
    default void onPlayerRemoved(Player player) {}

    /** Payload for the TV screen. Must be JSON-serializable. */
    Object hostView();

    /** Payload for one player's phone. Must not leak other players' secret choices. */
    Object playerView(Player player);

    boolean isFinished();
}
