package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Color Dilemma: a round-robin prisoner's dilemma. Each round players are paired (one bye per round when the count
 * is odd) and secretly toggle GREEN or RED for 25s; only the selection at the deadline counts.
 * GREEN/GREEN = 3 each, RED/RED = 1 each, RED vs GREEN = 5 / 0, bye = 2. Rounds = min(2(n-1), 12). A 5s result pause follows
 * each round, then the next round starts automatically: there is no manual advance.
 *
 * Scores are private: each phone sees only its own points and its opponent's last choice. The TV
 * sees pairings only, until the final standings (totals only, never who picked what).
 */
public class ColorDilemmaGame implements PartyGame {

    public static final String ID = "colordilemma";

    static final long ROUND_MS = 25_000;
    static final long RESULT_MS = 5_000;
    static final int MAX_ROUNDS = 12;
    static final int BYE_POINTS = 2;

    enum Choice { GREEN, RED }

    private enum Phase { ROUND, RESULT, FINAL }

    /** b == null means a has a bye. */
    record Pair(String a, String b) {
        boolean has(String id) {
            return id.equals(a) || id.equals(b);
        }

        String opponentOf(String id) {
            return id.equals(a) ? b : a;
        }
    }

    private record Result(Choice yours, Choice opponents, int points, String opponentId) {}

    private final List<Player> participants = new ArrayList<>();
    private final Map<String, Player> byId = new HashMap<>();
    private final Map<String, Choice> choices = new HashMap<>();
    private final Map<String, Integer> gamePoints = new HashMap<>();
    private final Map<String, Result> lastResults = new HashMap<>();
    private List<List<Pair>> schedule = new ArrayList<>();
    private int roundIndex;
    private Phase phase;
    private long deadline;

    static int roundCount(int players) {
        return Math.min(2 * (players - 1), MAX_ROUNDS);
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public boolean hidesScores() {
        return true;
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Color Dilemma needs at least 2 players.");
        }
        participants.addAll(players);
        players.forEach(p -> byId.put(p.getId(), p));
        List<String> ids = new ArrayList<>(players.stream().map(Player::getId).toList());
        Collections.shuffle(ids);
        schedule = buildSchedule(ids, roundCount(ids.size()));
        roundIndex = 0;
        startRound(now);
    }

    /**
     * Circle-method round robin: one cycle meets every pair exactly once (with a bye slot when odd).
     * Later cycles repeat those rounds in a shuffled order, never repeating the previous round back to back.
     */
    static List<List<Pair>> buildSchedule(List<String> ids, int rounds) {
        List<String> slots = new ArrayList<>(ids);
        if (slots.size() % 2 == 1) {
            slots.add(null);
        }
        int m = slots.size();
        List<List<Pair>> cycle = new ArrayList<>();
        for (int r = 0; r < m - 1; r++) {
            List<Pair> round = new ArrayList<>();
            for (int i = 0; i < m / 2; i++) {
                String x = slots.get(i);
                String y = slots.get(m - 1 - i);
                if (x == null) {
                    round.add(new Pair(y, null));
                } else {
                    round.add(new Pair(x, y));
                }
            }
            cycle.add(round);
            // keep slot 0 fixed, rotate the rest one step
            slots.add(1, slots.remove(m - 1));
        }

        List<List<Pair>> schedule = new ArrayList<>();
        List<List<Pair>> next = cycle;
        while (schedule.size() < rounds) {
            for (List<Pair> round : next) {
                if (schedule.size() == rounds) {
                    break;
                }
                schedule.add(round);
            }
            next = new ArrayList<>(cycle);
            Collections.shuffle(next);
            if (next.size() > 1 && next.get(0) == schedule.get(schedule.size() - 1)) {
                Collections.swap(next, 0, next.size() - 1);
            }
        }
        return schedule;
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        if (phase != Phase.ROUND || !byId.containsKey(player.getId())) {
            return false;
        }
        int index = PartyInputs.choice(input, 2);
        choices.put(player.getId(), index == 0 ? Choice.GREEN : Choice.RED);
        return true;
    }

    @Override
    public boolean onTick(long now) {
        if (phase == Phase.ROUND && now >= deadline) {
            scoreRound();
            phase = Phase.RESULT;
            deadline = now + RESULT_MS;
            return true;
        }
        if (phase == Phase.RESULT && now >= deadline) {
            if (roundIndex + 1 < schedule.size()) {
                roundIndex++;
                startRound(now);
            } else {
                phase = Phase.FINAL;
                deadline = 0;
            }
            return true;
        }
        return false;
    }

    /** Fully automatic: the host's "Next" does nothing. */
    @Override
    public boolean onAdvance(long now) {
        return false;
    }

    @Override
    public void onPlayerRemoved(Player player) {
        String id = player.getId();
        participants.remove(player);
        byId.remove(id);
        choices.remove(id);
        // From the round in progress onward, their opponents get byes instead
        int from = phase == Phase.ROUND ? roundIndex : roundIndex + 1;
        for (int r = from; r < schedule.size(); r++) {
            List<Pair> updated = new ArrayList<>();
            for (Pair pair : schedule.get(r)) {
                if (!pair.has(id)) {
                    updated.add(pair);
                } else if (pair.opponentOf(id) != null) {
                    updated.add(new Pair(pair.opponentOf(id), null));
                }
            }
            schedule.set(r, updated);
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    private void startRound(long now) {
        choices.clear();
        lastResults.clear();
        participants.forEach(p -> choices.put(p.getId(), Choice.GREEN));
        phase = Phase.ROUND;
        deadline = now + ROUND_MS;
    }

    private void scoreRound() {
        for (Pair pair : schedule.get(roundIndex)) {
            if (pair.b() == null) {
                award(pair.a(), BYE_POINTS, new Result(choices.get(pair.a()), null, BYE_POINTS, null));
                continue;
            }
            Choice a = choices.getOrDefault(pair.a(), Choice.GREEN);
            Choice b = choices.getOrDefault(pair.b(), Choice.GREEN);
            award(pair.a(), payoff(a, b), new Result(a, b, payoff(a, b), pair.b()));
            award(pair.b(), payoff(b, a), new Result(b, a, payoff(b, a), pair.a()));
        }
    }

    static int payoff(Choice mine, Choice theirs) {
        if (mine == Choice.GREEN) {
            return theirs == Choice.GREEN ? 3 : 0;
        }
        return theirs == Choice.GREEN ? 5 : 1;
    }

    private void award(String playerId, int points, Result result) {
        Player player = byId.get(playerId);
        if (player == null) {
            return;
        }
        gamePoints.merge(playerId, points, Integer::sum);
        player.addScore(points);
        lastResults.put(playerId, result);
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("round", roundIndex + 1);
        view.put("rounds", schedule.size());
        if (deadline > 0) {
            view.put("deadline", deadline);
        }
        return view;
    }

    private Map<String, Object> ref(String playerId) {
        Player p = byId.get(playerId);
        return Map.of("id", playerId, "name", p == null ? "?" : p.getName());
    }

    @Override
    public Object hostView() {
        Map<String, Object> view = baseView();
        if (phase == Phase.FINAL) {
            view.put("standings", standings());
            return view;
        }
        List<Map<String, Object>> pairs = new ArrayList<>();
        for (Pair pair : schedule.get(roundIndex)) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("a", ref(pair.a()));
            if (pair.b() != null) {
                row.put("b", ref(pair.b()));
            }
            pairs.add(row);
        }
        view.put("pairs", pairs);
        return view;
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        String id = player.getId();
        view.put("gamePoints", gamePoints.getOrDefault(id, 0));
        if (phase == Phase.FINAL) {
            view.put("standings", standings());
            return view;
        }
        schedule.get(roundIndex).stream().filter(p -> p.has(id)).findFirst().ifPresent(pair -> {
            String opponent = pair.opponentOf(id);
            if (opponent == null) {
                view.put("bye", true);
                view.put("byePoints", BYE_POINTS);
            } else {
                view.put("opponent", ref(opponent));
            }
        });
        Choice mine = choices.get(id);
        if (phase == Phase.ROUND && mine != null) {
            view.put("yourChoice", mine.name());
        }
        Result result = lastResults.get(id);
        if (phase == Phase.RESULT && result != null) {
            Map<String, Object> last = new LinkedHashMap<>();
            last.put("yourChoice", result.yours().name());
            if (result.opponents() != null) {
                last.put("opponentChoice", result.opponents().name());
            }
            last.put("points", result.points());
            last.put("bye", result.opponentId() == null);
            view.put("lastResult", last);
        }
        return view;
    }

    private List<Map<String, Object>> standings() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Player p : participants) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", p.getId());
            row.put("name", p.getName());
            row.put("points", gamePoints.getOrDefault(p.getId(), 0));
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt(r -> -(Integer) r.get("points")));
        return rows;
    }
}
