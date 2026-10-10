package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * Not a scored game: splits the players into random teams of at most k, lettered A, B, C...
 *
 * Flow: PICK (host/VIP chooses k) -> TEAMS (shown until reroll, change size, or exit) -> DONE.
 * The host/VIP drives it with {@link #onControl} actions: assign{k}, reroll, changeSize, exit.
 * Teams = (n + k - 1) / k, dealt round-robin from a shuffle so sizes differ by at most 1.
 * Exit skips the game-over screen and goes straight back to the lobby ({@link #returnsToLobby}).
 */
public class TeamAssignmentGame implements PartyGame {

    public static final String ID = "teamassignment";

    static final int MIN_K = 2;
    static final int MAX_K = 8;

    enum Phase { PICK, TEAMS, DONE }

    private record Team(char letter, List<Player> players) {}

    private final Random random;
    private final List<Player> players = new ArrayList<>();
    private List<Team> teams = List.of();
    private Phase phase;
    private int k;

    public TeamAssignmentGame() {
        this(new Random());
    }

    TeamAssignmentGame(Random random) {
        this.random = random;
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Team Assignment needs at least 2 players.");
        }
        this.players.addAll(players);
        phase = Phase.PICK;
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        throw new IllegalArgumentException("Only the host or VIP controls this game");
    }

    @Override
    public boolean onControl(JsonNode action, long now) {
        switch (action.path("action").asText("")) {
            case "assign" -> {
                requirePhase(Phase.PICK);
                JsonNode value = action.path("k");
                if (!value.isInt() || value.asInt() < MIN_K || value.asInt() > MAX_K) {
                    throw new IllegalArgumentException("Team size must be " + MIN_K + "-" + MAX_K);
                }
                k = value.asInt();
                assign();
                phase = Phase.TEAMS;
            }
            case "reroll" -> {
                requirePhase(Phase.TEAMS);
                assign();
            }
            case "changeSize" -> {
                requirePhase(Phase.TEAMS);
                phase = Phase.PICK;
            }
            case "exit" -> phase = Phase.DONE;
            default -> throw new IllegalArgumentException("Unexpected action");
        }
        return true;
    }

    @Override
    public boolean onTick(long now) {
        return false; // no deadlines: nothing is waiting on player input
    }

    @Override
    public boolean onAdvance(long now) {
        return false; // driven by onControl
    }

    /** The player leaves their team; nobody else moves, and an emptied team is dropped (letters are kept). */
    @Override
    public void onPlayerRemoved(Player player) {
        players.remove(player);
        List<Team> kept = new ArrayList<>();
        for (Team t : teams) {
            List<Player> members = new ArrayList<>(t.players());
            members.remove(player);
            if (!members.isEmpty()) {
                kept.add(new Team(t.letter(), members));
            }
        }
        teams = kept;
    }

    @Override
    public boolean returnsToLobby() {
        return true;
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.DONE;
    }

    private void requirePhase(Phase allowed) {
        if (phase != allowed) {
            throw new IllegalArgumentException("Not now");
        }
    }

    static int teamCount(int players, int k) {
        return (players + k - 1) / k;
    }

    /** Shuffle, then deal round-robin into (n + k - 1) / k teams lettered from A. */
    private void assign() {
        int count = teamCount(players.size(), k);
        List<Player> shuffled = new ArrayList<>(players);
        Collections.shuffle(shuffled, random);
        List<Team> dealt = new ArrayList<>();
        for (int i = 0; i < count; i++) {
            dealt.add(new Team((char) ('A' + i), new ArrayList<>()));
        }
        for (int i = 0; i < shuffled.size(); i++) {
            dealt.get(i % count).players().add(shuffled.get(i));
        }
        teams = dealt;
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("playerCount", players.size());
        view.put("minK", MIN_K);
        view.put("maxK", MAX_K);
        if (k > 0) {
            view.put("k", k);
        }
        if (phase == Phase.TEAMS) {
            view.put("teams", teams.stream().map(t -> Map.of(
                    "letter", String.valueOf(t.letter()),
                    "players", t.players().stream()
                            .map(p -> Map.of("playerId", p.getId(), "name", p.getName())).toList())).toList());
        }
        return view;
    }

    @Override
    public Object hostView() {
        return baseView();
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        if (phase == Phase.TEAMS) {
            for (int i = 0; i < teams.size(); i++) {
                if (teams.get(i).players().contains(player)) {
                    view.put("yourTeamIndex", i);
                }
            }
        }
        return view;
    }
}
