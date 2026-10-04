package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

/**
 * A physical elimination game played with a real deck of cards laid out on a table and extendable pointers.
 *
 * Each round the remaining players are split at random into K = (n + 2) / 3 groups (sizes differ by at most 1,
 * never more than 3). Every group gets a different card, and its members race to touch that physical card.
 * The host or VIP judges who touched last and eliminates them (or nobody, on a tie). Cards are drawn without
 * replacement across rounds so nobody remembers where a card was; the pile is rebuilt (minus the last round's
 * cards) when it runs short.
 *
 * Flow: READY -> COUNTDOWN (5s) -> CARDS -> RESULT -> COUNTDOWN ... -> FINAL. The host/VIP drives it with
 * {@link #onControl} actions: startRound, eliminate{playerId?}, endGame.
 * Scoring: every survivor +1 each time a round resolves; the last player standing +3.
 */
public class CardConundrumGame implements PartyGame {

    public static final String ID = "cardconundrum";

    static final long COUNTDOWN_MS = 5_000;
    static final int WINNER_BONUS = 3;
    static final List<String> RANKS = List.of("A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K");
    static final List<String> SUITS = List.of("S", "H", "D", "C");

    enum Phase { READY, COUNTDOWN, CARDS, RESULT, FINAL }

    record Card(String rank, String suit) {}

    private record Group(Card card, List<Player> players) {}

    private record Elimination(Player player, int round) {}

    private final Random random;
    private final List<Player> alive = new ArrayList<>();
    /** Newest first. */
    private final List<Elimination> eliminated = new ArrayList<>();
    private final Map<String, Integer> earned = new HashMap<>();
    private final List<Card> pile = new ArrayList<>();
    private List<Group> groups = List.of();
    private Phase phase;
    private int round;
    private long deadline;
    private boolean resolved; // the current round has a result (possibly a tie)
    private Player lastEliminated;
    private Player winner;

    public CardConundrumGame() {
        this(new Random());
    }

    CardConundrumGame(Random random) {
        this.random = random;
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Card Conundrum needs at least 2 players.");
        }
        alive.addAll(players);
        players.forEach(p -> earned.put(p.getId(), 0));
        rebuildPile(List.of());
        phase = Phase.READY;
        round = 1;
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        throw new IllegalArgumentException("Only the host or VIP controls this game");
    }

    @Override
    public boolean onControl(JsonNode action, long now) {
        switch (action.path("action").asText("")) {
            case "startRound" -> {
                requirePhase(Phase.READY, Phase.RESULT);
                if (phase == Phase.RESULT) {
                    round++;
                }
                deal();
                resolved = false;
                lastEliminated = null;
                phase = Phase.COUNTDOWN;
                deadline = now + COUNTDOWN_MS;
            }
            case "eliminate" -> {
                requirePhase(Phase.CARDS);
                String id = action.path("playerId").asText("");
                Player out = null;
                if (!id.isEmpty()) {
                    out = alive.stream().filter(p -> p.getId().equals(id)).findFirst()
                            .orElseThrow(() -> new IllegalArgumentException("That player isn't in the game"));
                }
                resolve(out);
            }
            case "endGame" -> {
                requirePhase(Phase.READY, Phase.RESULT);
                phase = Phase.FINAL;
            }
            default -> throw new IllegalArgumentException("Unexpected action");
        }
        return true;
    }

    @Override
    public boolean onTick(long now) {
        if (phase == Phase.COUNTDOWN && now >= deadline) {
            phase = Phase.CARDS;
            return true;
        }
        return false;
    }

    @Override
    public boolean onAdvance(long now) {
        return false; // driven by onControl
    }

    @Override
    public void onPlayerRemoved(Player player) {
        if (!alive.remove(player)) {
            eliminated.removeIf(e -> e.player().equals(player));
            return;
        }
        List<Group> kept = new ArrayList<>();
        for (Group g : groups) {
            List<Player> members = new ArrayList<>(g.players());
            members.remove(player);
            if (!members.isEmpty()) {
                kept.add(new Group(g.card(), members));
            }
        }
        groups = kept;
        if (phase != Phase.FINAL && alive.size() <= 1) {
            if (alive.size() == 1) {
                crown(alive.get(0));
            }
            phase = Phase.FINAL;
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    private void requirePhase(Phase... allowed) {
        for (Phase p : allowed) {
            if (phase == p) {
                return;
            }
        }
        throw new IllegalArgumentException("Not now");
    }

    /** Ends the round: removes the loser (null = tie), pays survivors, and crowns a lone survivor. */
    private void resolve(Player out) {
        if (out != null) {
            alive.remove(out);
            eliminated.add(0, new Elimination(out, round));
        }
        lastEliminated = out;
        resolved = true;
        for (Player p : alive) {
            award(p, 1);
        }
        if (alive.size() == 1) {
            crown(alive.get(0));
            phase = Phase.FINAL;
        } else {
            phase = Phase.RESULT;
        }
    }

    private void crown(Player p) {
        winner = p;
        award(p, WINNER_BONUS);
    }

    private void award(Player p, int points) {
        p.addScore(points);
        earned.merge(p.getId(), points, Integer::sum);
    }

    /** K = (n + 2) / 3 groups, round-robin from a shuffle, each with a card no one has seen since the last reshuffle. */
    private void deal() {
        int k = groupCount(alive.size());
        if (pile.size() < k) {
            rebuildPile(groups.stream().map(Group::card).toList());
        }
        List<Player> shuffled = new ArrayList<>(alive);
        Collections.shuffle(shuffled, random);
        List<List<Player>> members = new ArrayList<>();
        for (int i = 0; i < k; i++) {
            members.add(new ArrayList<>());
        }
        for (int i = 0; i < shuffled.size(); i++) {
            members.get(i % k).add(shuffled.get(i));
        }
        List<Group> dealt = new ArrayList<>();
        for (List<Player> m : members) {
            dealt.add(new Group(pile.remove(pile.size() - 1), m));
        }
        groups = dealt;
    }

    static int groupCount(int players) {
        return (players + 2) / 3;
    }

    private void rebuildPile(List<Card> exclude) {
        pile.clear();
        for (String suit : SUITS) {
            for (String rank : RANKS) {
                Card card = new Card(rank, suit);
                if (!exclude.contains(card)) {
                    pile.add(card);
                }
            }
        }
        Collections.shuffle(pile, random);
    }

    /** Test hook: cards left before the next reshuffle. */
    int pileSize() {
        return pile.size();
    }

    // ---- views ----

    private static Map<String, Object> ref(Player p) {
        return Map.of("playerId", p.getId(), "name", p.getName());
    }

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("round", round);
        if (phase == Phase.COUNTDOWN) {
            view.put("deadline", deadline);
        }
        // Cards stay hidden during the countdown so nobody gets a head start
        if (phase == Phase.CARDS || phase == Phase.RESULT || (phase == Phase.FINAL && resolved)) {
            view.put("groups", groups.stream().map(g -> Map.of(
                    "card", Map.of("rank", g.card().rank(), "suit", g.card().suit()),
                    "players", g.players().stream().map(CardConundrumGame::ref).toList())).toList());
        }
        view.put("alive", alive.stream().map(CardConundrumGame::ref).toList());
        view.put("eliminated", eliminated.stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>(ref(e.player()));
            row.put("round", e.round());
            return row;
        }).toList());
        if (resolved && (phase == Phase.RESULT || phase == Phase.FINAL)) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("round", round);
            if (lastEliminated != null) {
                result.put("eliminated", ref(lastEliminated));
            }
            view.put("lastResult", result);
        }
        if (phase == Phase.FINAL) {
            if (winner != null) {
                view.put("winner", ref(winner));
            }
            view.put("standings", standings());
        }
        return view;
    }

    /** Survivors first (winner on top), then eliminated players, latest out first. */
    private List<Map<String, Object>> standings() {
        List<Player> order = new ArrayList<>(alive);
        order.sort((a, b) -> earned.get(b.getId()) - earned.get(a.getId()));
        eliminated.forEach(e -> order.add(e.player()));
        return order.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>(ref(p));
            row.put("points", earned.getOrDefault(p.getId(), 0));
            return row;
        }).toList();
    }

    @Override
    public Object hostView() {
        return baseView();
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        view.put("out", !alive.contains(player));
        if (view.containsKey("groups")) {
            for (int i = 0; i < groups.size(); i++) {
                if (groups.get(i).players().contains(player)) {
                    view.put("yourGroupIndex", i);
                }
            }
        }
        return view;
    }
}
