package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * One 60s round: every player can hand out up to 3 strikes (fewer when there are fewer than 4 players),
 * at most one per other player, and can take them back until the timer ends. Unused strikes are forfeit.
 * Each strike received costs 1 room point.
 *
 * Who struck whom is never sent anywhere; views only carry per-player totals and each phone's own picks.
 * Inputs don't broadcast: counts are republished at most once per second from {@link #onTick}, which also
 * caps the broadcast rate no matter how fast anyone taps.
 */
public class StrikeoutGame implements PartyGame {

    public static final String ID = "strikeout";

    static final int MAX_STRIKES = 3;
    static final long ROUND_MS = 60_000;
    static final long PUBLISH_MS = 1_000;

    private enum Phase { PLAY, FINAL }

    private final List<Player> participants = new ArrayList<>();
    /** giverId -> targetIds. Secret: never put in a view except the giver's own. */
    private final Map<String, Set<String>> picks = new HashMap<>();
    /** targetId -> strikes, as last published to the screens. */
    private Map<String, Integer> published = new HashMap<>();
    private Phase phase;
    private int maxStrikes;
    private long deadline;
    private long nextPublish;
    private boolean dirty;

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Strikeout needs at least 2 players.");
        }
        participants.addAll(players);
        players.forEach(p -> picks.put(p.getId(), new LinkedHashSet<>()));
        maxStrikes = Math.min(MAX_STRIKES, players.size() - 1);
        phase = Phase.PLAY;
        deadline = now + ROUND_MS;
        nextPublish = now + PUBLISH_MS;
        publish();
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        if (phase != Phase.PLAY || now >= deadline) {
            throw new IllegalArgumentException("Time's up");
        }
        Set<String> mine = picks.get(player.getId());
        if (mine == null) {
            throw new IllegalArgumentException("You're not in this game");
        }
        PartyInputs.Strike strike = PartyInputs.strike(input);
        String targetId = strike.playerId();
        if (!picks.containsKey(targetId)) {
            throw new IllegalArgumentException("That player isn't in this game");
        }
        if (targetId.equals(player.getId())) {
            throw new IllegalArgumentException("You can't strike yourself");
        }
        if (strike.on()) {
            if (!mine.contains(targetId)) {
                if (mine.size() >= maxStrikes) {
                    throw new IllegalArgumentException("No strikes left");
                }
                mine.add(targetId);
                dirty = true;
            }
        } else if (mine.remove(targetId)) {
            dirty = true;
        }
        return false; // published on the next 1s tick
    }

    @Override
    public boolean onTick(long now) {
        if (phase != Phase.PLAY) {
            return false;
        }
        if (now >= deadline) {
            finish();
            return true;
        }
        if (now < nextPublish) {
            return false;
        }
        nextPublish = now + PUBLISH_MS;
        if (!dirty) {
            return false;
        }
        publish();
        return true;
    }

    @Override
    public boolean onAdvance(long now) {
        return false; // timer only
    }

    @Override
    public void onPlayerRemoved(Player player) {
        participants.remove(player);
        picks.remove(player.getId());
        picks.values().forEach(set -> set.remove(player.getId())); // refund strikes aimed at them
        dirty = true;
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    private void publish() {
        Map<String, Integer> counts = new HashMap<>();
        picks.values().forEach(set -> set.forEach(target -> counts.merge(target, 1, Integer::sum)));
        published = counts;
        dirty = false;
    }

    private void finish() {
        publish();
        for (Player p : participants) {
            p.addScore(-strikesOn(p));
        }
        phase = Phase.FINAL;
    }

    private int strikesOn(Player p) {
        return published.getOrDefault(p.getId(), 0);
    }

    /** Test hook: a giver's current picks (never exposed in other players' views). */
    Set<String> picksOf(String playerId) {
        return Set.copyOf(picks.getOrDefault(playerId, Set.of()));
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("maxStrikes", maxStrikes);
        if (phase == Phase.PLAY) {
            view.put("deadline", deadline);
            view.put("players", participants.stream()
                    .map(p -> Map.<String, Object>of("playerId", p.getId(), "name", p.getName(), "strikes", strikesOn(p)))
                    .toList());
        } else {
            view.put("standings", standings());
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
        Set<String> mine = picks.get(player.getId());
        if (mine != null) {
            if (phase == Phase.PLAY) {
                view.put("yourPicks", new ArrayList<>(mine));
                view.put("remaining", maxStrikes - mine.size());
            }
            view.put("yourStrikes", strikesOn(player));
        }
        return view;
    }

    private List<Map<String, Object>> standings() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Player p : participants) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", p.getId());
            row.put("name", p.getName());
            row.put("strikes", strikesOn(p));
            row.put("points", -strikesOn(p));
            rows.add(row);
        }
        rows.sort(Comparator.comparingInt(r -> (Integer) r.get("strikes")));
        return rows;
    }
}
