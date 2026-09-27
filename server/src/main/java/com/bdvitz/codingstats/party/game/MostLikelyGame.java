package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Practice game for the "target another player" input. Three rounds of "Who is most likely to...?":
 * everyone votes for another player (VOTE, timed) -> REVEAL vote counts -> ... -> FINAL.
 * Voting for a round's top pick earns 1 point ("read the room"). Non-voters get nothing.
 * Self-votes are only allowed when a player is alone, so the game still runs with one phone.
 */
public class MostLikelyGame implements PartyGame {

    public static final String ID = "mostlikely";

    static final int ROUNDS = 3;
    private static final long VOTE_MS = 20_000;

    private enum Phase { VOTE, REVEAL, FINAL }

    private static final List<String> PROMPTS = List.of(
            "Who is most likely to become famous?",
            "Who is most likely to survive a zombie apocalypse?",
            "Who is most likely to forget their own birthday?",
            "Who is most likely to win a hot dog eating contest?",
            "Who is most likely to cry at a movie?",
            "Who is most likely to show up late to their own party?",
            "Who is most likely to adopt ten cats?",
            "Who is most likely to become a millionaire?"
    );

    private final List<Player> participants = new ArrayList<>();
    private final List<String> prompts = new ArrayList<>(PROMPTS);
    /** voterId -> targetId for the current round (secret until the reveal, and only counts are shown). */
    private final Map<String, String> votes = new HashMap<>();
    private final Map<String, Integer> points = new HashMap<>();
    private final Set<String> roundScorers = new HashSet<>();
    private Map<String, Integer> tally = new HashMap<>();
    private Phase phase;
    private int round;
    private long deadline;

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        participants.addAll(players);
        Collections.shuffle(prompts);
        round = 1;
        startVote(now);
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        if (phase != Phase.VOTE) {
            return false;
        }
        String targetId = PartyInputs.target(input);
        boolean known = participants.stream().anyMatch(p -> p.getId().equals(targetId));
        if (!known) {
            throw new IllegalArgumentException("That player isn't in this game");
        }
        if (targetId.equals(player.getId()) && participants.size() > 1) {
            throw new IllegalArgumentException("You can't vote for yourself");
        }
        votes.put(player.getId(), targetId);
        if (allConnectedVoted()) {
            reveal();
        }
        return true;
    }

    @Override
    public boolean onTick(long now) {
        if (phase == Phase.VOTE && now >= deadline) {
            reveal();
            return true;
        }
        return false;
    }

    @Override
    public boolean onAdvance(long now) {
        switch (phase) {
            case VOTE -> reveal();
            case REVEAL -> {
                if (round < ROUNDS) {
                    round++;
                    startVote(now);
                } else {
                    phase = Phase.FINAL;
                }
            }
            default -> {
                return false;
            }
        }
        return true;
    }

    @Override
    public void onPlayerRemoved(Player player) {
        participants.remove(player);
        votes.remove(player.getId());
        votes.values().removeIf(target -> target.equals(player.getId()));
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    private void startVote(long now) {
        votes.clear();
        roundScorers.clear();
        tally = new HashMap<>();
        phase = Phase.VOTE;
        deadline = now + VOTE_MS;
    }

    private boolean allConnectedVoted() {
        List<Player> connected = participants.stream().filter(Player::isConnected).toList();
        return !connected.isEmpty() && connected.stream().allMatch(p -> votes.containsKey(p.getId()));
    }

    private void reveal() {
        tally = new HashMap<>();
        votes.values().forEach(target -> tally.merge(target, 1, Integer::sum));
        int max = tally.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        votes.forEach((voter, target) -> {
            if (max > 0 && tally.get(target) == max) {
                roundScorers.add(voter);
            }
        });
        for (Player p : participants) {
            if (roundScorers.contains(p.getId())) {
                points.merge(p.getId(), 1, Integer::sum);
                p.addScore(1);
            }
        }
        phase = Phase.REVEAL;
        deadline = 0;
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("round", round);
        view.put("rounds", ROUNDS);
        if (deadline > 0) {
            view.put("deadline", deadline);
        }
        switch (phase) {
            case VOTE -> {
                view.put("prompt", prompts.get(round - 1));
                view.put("candidates", participants.stream()
                        .map(p -> Map.of("playerId", p.getId(), "name", p.getName()))
                        .toList());
            }
            case REVEAL -> {
                view.put("prompt", prompts.get(round - 1));
                view.put("results", results());
                view.put("lastRound", round >= ROUNDS);
            }
            case FINAL -> view.put("standings", standings());
        }
        return view;
    }

    @Override
    public Object hostView() {
        Map<String, Object> view = baseView();
        if (phase == Phase.VOTE) {
            view.put("answeredIds", new ArrayList<>(votes.keySet()));
            view.put("participantIds", participants.stream().map(Player::getId).toList());
        }
        return view;
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        String vote = votes.get(player.getId());
        if (vote != null && phase != Phase.FINAL) {
            view.put("yourVote", vote);
        }
        if (phase == Phase.REVEAL) {
            view.put("youScored", roundScorers.contains(player.getId()));
        }
        return view;
    }

    private List<Map<String, Object>> results() {
        int max = tally.values().stream().mapToInt(Integer::intValue).max().orElse(0);
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Player p : participants) {
            int count = tally.getOrDefault(p.getId(), 0);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", p.getId());
            row.put("name", p.getName());
            row.put("votes", count);
            row.put("top", max > 0 && count == max);
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt(r -> -(Integer) r.get("votes")));
        return rows;
    }

    private List<Map<String, Object>> standings() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Player p : participants) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", p.getId());
            row.put("name", p.getName());
            row.put("points", points.getOrDefault(p.getId(), 0));
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt(r -> -(Integer) r.get("points")));
        return rows;
    }
}
