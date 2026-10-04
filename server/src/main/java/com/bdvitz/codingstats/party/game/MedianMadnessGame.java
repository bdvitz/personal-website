package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Everyone secretly picks a whole number from 1 to 100 (30s or 60s, chosen in the lobby). Duplicate picks
 * are knocked out. The unique picks are placed in {@link MedianOrder} order (median first, then alternating
 * outward), and with n players 1st place earns n points, 2nd n-1, and so on. Duplicates and no-answers get 0.
 *
 * After the picks lock, a staged reveal runs on timers (host/VIP Next skips a step):
 * SORTED (list by number) -> DUPES (duplicates flagged red) -> ELIMINATED (greyed out) -> PLACING (places
 * filled in one at a time, rows never reorder) -> FINAL (points). Room points are added when FINAL starts so
 * the live scores don't spoil the reveal.
 */
public class MedianMadnessGame implements PartyGame {

    public static final String ID = "medianmadness";
    public static final String OPTION_TIME_LIMIT = "timeLimit";

    static final int MIN_PICK = 1;
    static final int MAX_PICK = 100;
    static final int DEFAULT_TIME_LIMIT_S = 60;
    static final long SORTED_MS = 4_000;
    static final long DUPES_MS = 3_000;
    static final long ELIMINATED_MS = 2_000;
    static final long PLACE_MS = 1_500;

    enum Phase { SUBMIT, SORTED, DUPES, ELIMINATED, PLACING, FINAL }

    enum Status { unique, duplicate, none }

    /** One results row, frozen when the picks lock. */
    private static final class Row {
        final Player player;
        final Integer value;
        Status status;
        int place; // 1-based, unique rows only
        int points;

        Row(Player player, Integer value) {
            this.player = player;
            this.value = value;
        }
    }

    private final List<Player> participants = new ArrayList<>();
    /** playerId -> pick. Secret until the reveal: only the picker's own view carries it. */
    private final Map<String, Integer> picks = new HashMap<>();
    /** Kicked after the picks locked: their row stays on screen but earns nothing. */
    private final Set<String> removedIds = new HashSet<>();
    private List<Row> rows = List.of();
    private int timeLimitS = DEFAULT_TIME_LIMIT_S;
    private int playerCount;
    private int placeCount;
    private int revealedPlaces;
    private Phase phase;
    private long deadline;

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void configure(Map<String, Integer> options) {
        timeLimitS = options.getOrDefault(OPTION_TIME_LIMIT, DEFAULT_TIME_LIMIT_S);
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Median Madness needs at least 2 players.");
        }
        participants.addAll(players);
        phase = Phase.SUBMIT;
        deadline = now + timeLimitS * 1000L;
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        if (phase != Phase.SUBMIT || now >= deadline) {
            throw new IllegalArgumentException("Time's up");
        }
        if (!participants.contains(player)) {
            throw new IllegalArgumentException("You're not in this game");
        }
        picks.put(player.getId(), (int) PartyInputs.number(input, MIN_PICK, MAX_PICK));
        if (everyoneConnectedPicked()) {
            lockPicks(now);
        }
        return true;
    }

    @Override
    public boolean onTick(long now) {
        // Someone who hadn't picked disconnected or was kicked: don't make everyone wait out the timer
        if (phase == Phase.SUBMIT && !picks.isEmpty() && everyoneConnectedPicked()) {
            lockPicks(now);
            return true;
        }
        if (phase == Phase.FINAL || now < deadline) {
            return false;
        }
        step(now);
        return true;
    }

    @Override
    public boolean onAdvance(long now) {
        if (phase == Phase.FINAL) {
            return false;
        }
        if (phase == Phase.PLACING) {
            revealedPlaces = placeCount; // skip the rest of the countdown
        }
        step(now);
        return true;
    }

    @Override
    public void onPlayerRemoved(Player player) {
        if (phase == Phase.SUBMIT) {
            participants.remove(player);
            picks.remove(player.getId());
        } else {
            removedIds.add(player.getId());
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    /** Moves to the next step (or the next placement) and sets its deadline. */
    private void step(long now) {
        switch (phase) {
            case SUBMIT -> lockPicks(now);
            case SORTED -> enter(Phase.DUPES, now + DUPES_MS);
            case DUPES -> enter(Phase.ELIMINATED, now + ELIMINATED_MS);
            case ELIMINATED -> {
                if (placeCount == 0) {
                    finish();
                } else {
                    revealedPlaces = 1;
                    enter(Phase.PLACING, now + PLACE_MS);
                }
            }
            case PLACING -> {
                if (revealedPlaces < placeCount) {
                    revealedPlaces++;
                    deadline = now + PLACE_MS;
                } else {
                    finish();
                }
            }
            case FINAL -> { }
        }
    }

    private void enter(Phase next, long nextDeadline) {
        phase = next;
        deadline = nextDeadline;
    }

    private boolean everyoneConnectedPicked() {
        return participants.stream().filter(Player::isConnected).allMatch(p -> picks.containsKey(p.getId()));
    }

    /** Freezes the results: sorted rows, duplicate/no-answer flags, and median-order places. */
    private void lockPicks(long now) {
        playerCount = participants.size();
        Map<Integer, Integer> counts = new HashMap<>();
        picks.values().forEach(v -> counts.merge(v, 1, Integer::sum));

        List<Row> built = new ArrayList<>();
        for (Player p : participants) {
            Row row = new Row(p, picks.get(p.getId()));
            row.status = row.value == null ? Status.none : counts.get(row.value) == 1 ? Status.unique : Status.duplicate;
            built.add(row);
        }
        // By number, no-answers last; ties keep join order
        built.sort(Comparator.comparing((Row r) -> r.value, Comparator.nullsLast(Comparator.naturalOrder())));

        List<Row> unique = built.stream().filter(r -> r.status == Status.unique).toList(); // already ascending
        List<Row> order = MedianOrder.order(unique);
        for (int i = 0; i < order.size(); i++) {
            Row row = order.get(i);
            row.place = i + 1;
            row.points = playerCount - i;
        }
        rows = built;
        placeCount = order.size();
        revealedPlaces = 0;
        enter(Phase.SORTED, now + SORTED_MS);
    }

    private void finish() {
        revealedPlaces = placeCount;
        for (Row row : rows) {
            if (row.points > 0 && !removedIds.contains(row.player.getId())) {
                row.player.addScore(row.points);
            }
        }
        phase = Phase.FINAL;
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("timeLimit", timeLimitS);
        view.put("playerCount", phase == Phase.SUBMIT ? participants.size() : playerCount);
        if (phase != Phase.FINAL) {
            view.put("deadline", deadline);
        }
        if (phase == Phase.SUBMIT) {
            view.put("answeredCount", picks.size());
        } else {
            view.put("rows", rows.stream().map(this::rowView).toList());
            view.put("revealedPlaces", revealedPlaces);
            view.put("placeCount", placeCount);
        }
        return view;
    }

    private Map<String, Object> rowView(Row row) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("playerId", row.player.getId());
        view.put("name", row.player.getName());
        if (row.value != null) {
            view.put("value", row.value);
        }
        view.put("status", row.status.name());
        if (row.place > 0 && row.place <= revealedPlaces) {
            view.put("place", row.place);
        }
        if (phase == Phase.FINAL) {
            view.put("points", removedIds.contains(row.player.getId()) ? 0 : row.points);
        }
        return view;
    }

    @Override
    public Object hostView() {
        Map<String, Object> view = baseView();
        if (phase == Phase.SUBMIT) {
            view.put("answeredIds", new ArrayList<>(picks.keySet()));
        }
        return view;
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        if (phase == Phase.SUBMIT && picks.containsKey(player.getId())) {
            view.put("yourPick", picks.get(player.getId()));
        }
        return view;
    }
}
