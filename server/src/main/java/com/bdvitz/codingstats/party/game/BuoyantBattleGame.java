package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.PartyException;
import com.bdvitz.codingstats.party.game.PartyInputs.Cell;
import com.bdvitz.codingstats.party.game.PartyInputs.Placement;
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
 * Team Battleship on a 5x5 grid. Players are split at random into two teams (Kraken and Anchor). Each team
 * elects a leader who does all of the team's actions, places ships of lengths 3, 2 and 2, and then both teams
 * bomb each other simultaneously until a fleet is sunk.
 *
 * Flow: ELECTION (60s) -> PLACE (120s) -> BOMB (25s) -> RESULT (3s) -> BOMB ... -> FINAL.
 * ELECTION ends early once every connected voter has voted, PLACE once both leaders are ready, BOMB once both
 * leaders have confirmed. The host/VIP can close voting, end placement, pause/resume ({@link #onControl}),
 * and skip the RESULT popup (Next).
 *
 * Leaders: a disconnected leader is replaced by a random connected teammate when PLACE and each BOMB round
 * start. A leader can hand off to a teammate; it takes effect when the next BOMB round starts.
 * Scoring: every player on a winning team gets (players at start) / 2. Sinking each other's last ship in the
 * same round is a draw, and both teams score.
 */
public class BuoyantBattleGame implements PartyGame {

    public static final String ID = "buoyantbattle";

    static final long ELECTION_MS = 60_000;
    static final long PLACE_MS = 120_000;
    static final long BOMB_MS = 25_000;
    static final long RESULT_MS = 3_000;
    static final int SIZE = 5;
    static final List<Integer> SHIP_LENGTHS = List.of(3, 2, 2);
    static final List<String> TEAM_NAMES = List.of("Kraken", "Anchor");
    static final List<String> TEAM_COLORS = List.of("cyan", "violet");

    enum Phase { ELECTION, PLACE, BOMB, RESULT, FINAL }

    private record Shot(Cell cell, boolean hit, int sunkShip) {}

    private static final class Ship {
        final int length;
        List<Cell> cells = List.of(); // empty = not placed yet

        Ship(int length) {
            this.length = length;
        }

        boolean placed() {
            return !cells.isEmpty();
        }
    }

    private static final class Team {
        final int index;
        final List<Player> players = new ArrayList<>();
        final Map<String, String> votes = new LinkedHashMap<>(); // voterId -> candidateId
        final List<Ship> ships = new ArrayList<>();
        /** Shots fired at this team's board, oldest first. */
        final List<Shot> shotsReceived = new ArrayList<>();
        Player leader;
        Player pendingLeader;
        boolean ready;
        Cell target;
        boolean confirmed;
        Shot lastShot; // fired by this team in the latest resolved round

        Team(int index) {
            this.index = index;
            SHIP_LENGTHS.forEach(len -> ships.add(new Ship(len)));
        }

        boolean bombed(Cell cell) {
            return shotsReceived.stream().anyMatch(s -> s.cell().equals(cell));
        }

        boolean sunk(Ship ship) {
            return ship.placed() && ship.cells.stream().allMatch(this::bombed);
        }

        int shipsLeft() {
            return (int) ships.stream().filter(s -> !sunk(s)).count();
        }
    }

    private final Random random;
    private final List<Team> teams = List.of(new Team(0), new Team(1));
    private final Map<String, Integer> earned = new HashMap<>();
    private final List<Team> winners = new ArrayList<>();
    private Phase phase;
    private int round;
    private int startCount;
    private long deadline;
    private boolean paused;
    private long remainingMs;

    public BuoyantBattleGame() {
        this(new Random());
    }

    BuoyantBattleGame(Random random) {
        this.random = random;
    }

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        if (players.size() < 2) {
            throw new PartyException("NOT_ENOUGH_PLAYERS", "Buoyant Battle needs at least 2 players.");
        }
        startCount = players.size();
        List<Player> shuffled = new ArrayList<>(players);
        Collections.shuffle(shuffled, random);
        // With an odd count the extra player lands on a random team
        int firstSize = players.size() / 2 + (players.size() % 2 == 1 && random.nextBoolean() ? 1 : 0);
        teams.get(0).players.addAll(shuffled.subList(0, firstSize));
        teams.get(1).players.addAll(shuffled.subList(firstSize, shuffled.size()));
        players.forEach(p -> earned.put(p.getId(), 0));
        for (Team t : teams) {
            if (t.players.size() == 1) {
                t.leader = t.players.get(0); // nothing to vote on
            }
        }
        if (teams.stream().allMatch(t -> t.leader != null)) {
            beginPlacement(now);
        } else {
            phase = Phase.ELECTION;
            deadline = now + ELECTION_MS;
        }
    }

    // ---- input ----

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        Team team = teamOf(player);
        if (team == null) {
            throw new IllegalArgumentException("You're not in this game");
        }
        switch (PartyInputs.kind(input)) {
            case "target" -> vote(team, player, PartyInputs.target(input), now);
            case "place" -> {
                requireOpen(now, Phase.PLACE);
                requireLeader(team, player);
                place(team, PartyInputs.place(input, SIZE, SHIP_LENGTHS.size()));
                team.ready = false;
            }
            case "randomize" -> {
                requireOpen(now, Phase.PLACE);
                requireLeader(team, player);
                team.ships.forEach(s -> s.cells = List.of());
                placeRemaining(team);
                team.ready = false;
            }
            case "cell" -> {
                requireOpen(now, Phase.BOMB);
                requireLeader(team, player);
                Cell cell = PartyInputs.cell(input, SIZE);
                if (opponent(team).bombed(cell)) {
                    throw new IllegalArgumentException("That square was already bombed");
                }
                team.target = cell;
                team.confirmed = false;
            }
            case "confirm" -> confirm(team, player, input, now);
            case "handoff" -> handoff(team, player, input.path("playerId").asText(""));
            default -> throw new IllegalArgumentException("Unexpected input");
        }
        progress(now);
        return true;
    }

    private void vote(Team team, Player voter, String candidateId, long now) {
        requireOpen(now, Phase.ELECTION);
        if (team.leader != null) {
            throw new IllegalArgumentException("Your team's leader is already set");
        }
        if (team.players.stream().noneMatch(p -> p.getId().equals(candidateId))) {
            throw new IllegalArgumentException("Vote for someone on your team");
        }
        team.votes.put(voter.getId(), candidateId);
    }

    private void place(Team team, Placement placement) {
        Ship ship = team.ships.get(placement.ship());
        List<Cell> cells = cellsFor(placement.row(), placement.col(), ship.length, placement.vertical());
        if (cells == null) {
            throw new IllegalArgumentException("That ship doesn't fit there");
        }
        for (Ship other : team.ships) {
            if (other != ship && other.cells.stream().anyMatch(cells::contains)) {
                throw new IllegalArgumentException("Ships can't overlap");
            }
        }
        ship.cells = cells;
    }

    private void confirm(Team team, Player player, JsonNode input, long now) {
        JsonNode on = input.path("on");
        if (!on.isBoolean()) {
            throw new IllegalArgumentException("Unexpected input");
        }
        if (phase == Phase.PLACE) {
            requireOpen(now, Phase.PLACE);
            requireLeader(team, player);
            if (on.asBoolean() && !team.ships.stream().allMatch(Ship::placed)) {
                throw new IllegalArgumentException("Place all 3 ships first");
            }
            team.ready = on.asBoolean();
        } else {
            requireOpen(now, Phase.BOMB);
            requireLeader(team, player);
            if (on.asBoolean() && team.target == null) {
                throw new IllegalArgumentException("Pick a square first");
            }
            team.confirmed = on.asBoolean();
        }
    }

    private void handoff(Team team, Player player, String targetId) {
        if (phase == Phase.ELECTION || phase == Phase.FINAL) {
            throw new IllegalArgumentException("Not now");
        }
        requireLeader(team, player);
        if (targetId.isEmpty()) {
            team.pendingLeader = null;
            return;
        }
        Player next = team.players.stream().filter(p -> p.getId().equals(targetId)).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Pick a teammate"));
        team.pendingLeader = next == player ? null : next;
    }

    private void requireOpen(long now, Phase expected) {
        if (phase != expected) {
            throw new IllegalArgumentException("Not now");
        }
        if (!paused && now >= deadline) {
            throw new IllegalArgumentException("Time's up");
        }
    }

    private static void requireLeader(Team team, Player player) {
        if (team.leader != player) {
            throw new IllegalArgumentException("Only your leader can do that");
        }
    }

    // ---- host/VIP ----

    @Override
    public boolean onControl(JsonNode action, long now) {
        switch (action.path("action").asText("")) {
            case "closeVote" -> {
                requirePhase(Phase.ELECTION);
                paused = false;
                closeElection(now);
            }
            case "endPlacement" -> {
                requirePhase(Phase.PLACE);
                paused = false;
                beginBombing(now);
            }
            case "pause" -> {
                if (phase == Phase.FINAL || paused) {
                    throw new IllegalArgumentException("Not now");
                }
                paused = true;
                remainingMs = Math.max(0, deadline - now);
            }
            case "resume" -> {
                if (!paused) {
                    throw new IllegalArgumentException("Not now");
                }
                paused = false;
                deadline = now + remainingMs;
                progress(now);
            }
            default -> throw new IllegalArgumentException("Unexpected action");
        }
        return true;
    }

    private void requirePhase(Phase expected) {
        if (phase != expected) {
            throw new IllegalArgumentException("Not now");
        }
    }

    /** Next skips the result popup. */
    @Override
    public boolean onAdvance(long now) {
        if (phase != Phase.RESULT) {
            return false;
        }
        paused = false;
        beginBombing(now);
        return true;
    }

    @Override
    public boolean onTick(long now) {
        return progress(now);
    }

    /** Moves on when the deadline passed or everyone needed has acted. Nothing moves while paused. */
    private boolean progress(long now) {
        if (paused) {
            return false;
        }
        boolean due = now >= deadline;
        switch (phase) {
            case ELECTION -> {
                if (due || everyoneVoted()) {
                    closeElection(now);
                    return true;
                }
            }
            case PLACE -> {
                if (due || teams.stream().allMatch(t -> t.ready)) {
                    beginBombing(now);
                    return true;
                }
            }
            case BOMB -> {
                if (due || teams.stream().allMatch(t -> t.confirmed)) {
                    resolveRound(now);
                    return true;
                }
            }
            case RESULT -> {
                if (due) {
                    beginBombing(now);
                    return true;
                }
            }
            default -> {}
        }
        return false;
    }

    // ---- phases ----

    private boolean everyoneVoted() {
        return teams.stream().filter(t -> t.leader == null).allMatch(t ->
                t.players.stream().filter(Player::isConnected).allMatch(p -> t.votes.containsKey(p.getId())));
    }

    /** Most votes wins; ties (and no votes at all) are broken at random, preferring connected players for the latter. */
    private void closeElection(long now) {
        for (Team t : teams) {
            if (t.leader != null) {
                continue;
            }
            Map<String, Integer> tally = new HashMap<>();
            t.votes.values().forEach(id -> tally.merge(id, 1, Integer::sum));
            int top = tally.values().stream().max(Integer::compare).orElse(0);
            List<Player> best = top == 0
                    ? List.of()
                    : t.players.stream().filter(p -> tally.getOrDefault(p.getId(), 0) == top).toList();
            t.leader = best.isEmpty() ? pickAnyone(t) : best.get(random.nextInt(best.size()));
        }
        beginPlacement(now);
    }

    private void beginPlacement(long now) {
        teams.forEach(this::replaceIfDisconnected);
        phase = Phase.PLACE;
        deadline = now + PLACE_MS;
    }

    private void beginBombing(long now) {
        for (Team t : teams) {
            placeRemaining(t);
            if (t.pendingLeader != null) {
                if (t.pendingLeader.isConnected()) {
                    t.leader = t.pendingLeader;
                }
                t.pendingLeader = null;
            }
            replaceIfDisconnected(t);
            t.target = null;
            t.confirmed = false;
        }
        round++;
        phase = Phase.BOMB;
        deadline = now + BOMB_MS;
    }

    /** Both shots land together; unpicked squares are filled at random. */
    private void resolveRound(long now) {
        List<Cell> aims = new ArrayList<>();
        for (Team t : teams) {
            aims.add(t.target != null ? t.target : randomUnbombed(opponent(t)));
        }
        for (Team t : teams) {
            Team opp = opponent(t);
            Cell cell = aims.get(t.index);
            int shipIndex = -1;
            for (int i = 0; i < opp.ships.size(); i++) {
                if (opp.ships.get(i).cells.contains(cell)) {
                    shipIndex = i;
                }
            }
            // Record first so sunk() sees this hit
            opp.shotsReceived.add(new Shot(cell, shipIndex >= 0, -1));
            int sunkShip = shipIndex >= 0 && opp.sunk(opp.ships.get(shipIndex)) ? shipIndex : -1;
            Shot shot = new Shot(cell, shipIndex >= 0, sunkShip);
            opp.shotsReceived.set(opp.shotsReceived.size() - 1, shot);
            t.lastShot = shot;
        }
        List<Team> won = teams.stream().filter(t -> opponent(t).shipsLeft() == 0).toList();
        if (won.isEmpty()) {
            phase = Phase.RESULT;
            deadline = now + RESULT_MS;
        } else {
            finish(won);
        }
    }

    private void finish(List<Team> won) {
        int points = startCount / 2;
        for (Team t : won) {
            winners.add(t);
            for (Player p : t.players) {
                p.addScore(points);
                earned.merge(p.getId(), points, Integer::sum);
            }
        }
        paused = false;
        phase = Phase.FINAL;
    }

    @Override
    public void onPlayerRemoved(Player player) {
        Team team = teamOf(player);
        if (team == null) {
            return;
        }
        team.players.remove(player);
        earned.remove(player.getId());
        team.votes.remove(player.getId());
        team.votes.values().removeIf(id -> id.equals(player.getId()));
        if (team.pendingLeader == player) {
            team.pendingLeader = null;
        }
        if (phase == Phase.FINAL) {
            return;
        }
        if (team.players.isEmpty()) {
            team.leader = null;
            finish(List.of(opponent(team)));
            return;
        }
        if (phase == Phase.ELECTION) {
            if (team.players.size() == 1) {
                team.leader = team.players.get(0);
            }
        } else if (team.leader == player) {
            team.leader = pickAnyone(team);
        }
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    // ---- helpers ----

    private Team teamOf(Player player) {
        return teams.stream().filter(t -> t.players.contains(player)).findFirst().orElse(null);
    }

    private Team opponent(Team team) {
        return teams.get(1 - team.index);
    }

    private void replaceIfDisconnected(Team team) {
        if (team.leader == null || !team.leader.isConnected()) {
            List<Player> connected = team.players.stream().filter(Player::isConnected).toList();
            if (!connected.isEmpty()) {
                team.leader = connected.get(random.nextInt(connected.size()));
            } else if (team.leader == null) {
                team.leader = pickAnyone(team);
            }
        }
    }

    /** A random teammate, connected ones first. */
    private Player pickAnyone(Team team) {
        List<Player> connected = team.players.stream().filter(Player::isConnected).toList();
        List<Player> pool = connected.isEmpty() ? team.players : connected;
        return pool.isEmpty() ? null : pool.get(random.nextInt(pool.size()));
    }

    /** The ship's squares from its top/left end, or null if it runs off the board. */
    static List<Cell> cellsFor(int row, int col, int length, boolean vertical) {
        List<Cell> cells = new ArrayList<>();
        for (int i = 0; i < length; i++) {
            int r = vertical ? row + i : row;
            int c = vertical ? col : col + i;
            if (r >= SIZE || c >= SIZE) {
                return null;
            }
            cells.add(new Cell(r, c));
        }
        return cells;
    }

    /** Drops every unplaced ship somewhere legal at random. Starts over if the fixed ships leave no room. */
    private void placeRemaining(Team team) {
        for (int attempt = 0; attempt < 2; attempt++) {
            boolean ok = true;
            for (Ship ship : team.ships) {
                if (ship.placed()) {
                    continue;
                }
                List<List<Cell>> options = new ArrayList<>();
                for (int r = 0; r < SIZE; r++) {
                    for (int c = 0; c < SIZE; c++) {
                        for (boolean vertical : new boolean[] {false, true}) {
                            List<Cell> cells = cellsFor(r, c, ship.length, vertical);
                            if (cells != null && team.ships.stream().noneMatch(o -> o.cells.stream().anyMatch(cells::contains))) {
                                options.add(cells);
                            }
                        }
                    }
                }
                if (options.isEmpty()) {
                    ok = false;
                    break;
                }
                ship.cells = options.get(random.nextInt(options.size()));
            }
            if (ok) {
                return;
            }
            team.ships.forEach(s -> s.cells = List.of());
        }
    }

    private Cell randomUnbombed(Team board) {
        List<Cell> open = new ArrayList<>();
        for (int r = 0; r < SIZE; r++) {
            for (int c = 0; c < SIZE; c++) {
                Cell cell = new Cell(r, c);
                if (!board.bombed(cell)) {
                    open.add(cell);
                }
            }
        }
        return open.get(random.nextInt(open.size()));
    }

    // ---- views ----

    private static Map<String, Object> ref(Player p) {
        return Map.of("playerId", p.getId(), "name", p.getName());
    }

    private static Map<String, Object> cell(Cell c) {
        return Map.of("row", c.row(), "col", c.col());
    }

    private Map<String, Object> teamView(Team t) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("name", TEAM_NAMES.get(t.index));
        view.put("color", TEAM_COLORS.get(t.index));
        view.put("players", t.players.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>(ref(p));
            row.put("connected", p.isConnected());
            return row;
        }).toList());
        if (t.leader != null) {
            view.put("leaderId", t.leader.getId());
        }
        view.put("shipsLeft", t.shipsLeft());
        view.put("shots", t.shotsReceived.stream().map(s -> {
            Map<String, Object> row = new LinkedHashMap<>(cell(s.cell()));
            row.put("hit", s.hit());
            return row;
        }).toList());
        // Sunk ships are public; afloat ones only at the end
        view.put("sunk", t.ships.stream().filter(t::sunk).map(s -> s.cells.stream().map(BuoyantBattleGame::cell).toList()).toList());
        if (phase == Phase.ELECTION) {
            view.put("votedIds", List.copyOf(t.votes.keySet()));
        }
        if (phase == Phase.PLACE) {
            view.put("ready", t.ready);
        }
        if (phase == Phase.BOMB) {
            view.put("confirmed", t.confirmed);
        }
        if (phase == Phase.FINAL) {
            view.put("ships", shipsView(t));
        }
        return view;
    }

    private static List<Map<String, Object>> shipsView(Team t) {
        return t.ships.stream().map(s -> Map.<String, Object>of(
                "length", s.length,
                "cells", s.cells.stream().map(BuoyantBattleGame::cell).toList())).toList();
    }

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        view.put("round", round);
        if (paused) {
            view.put("paused", true);
            view.put("remainingMs", remainingMs);
        } else if (phase != Phase.FINAL) {
            view.put("deadline", deadline);
        }
        view.put("teams", teams.stream().map(this::teamView).toList());
        if ((phase == Phase.RESULT || phase == Phase.FINAL) && round > 0 && teams.get(0).lastShot != null) {
            view.put("lastResult", Map.of("round", round, "shots", teams.stream().map(t -> {
                Map<String, Object> row = new LinkedHashMap<>(cell(t.lastShot.cell()));
                row.put("team", t.index);
                row.put("hit", t.lastShot.hit());
                row.put("sunk", t.lastShot.sunkShip() >= 0);
                return row;
            }).toList()));
        }
        if (phase == Phase.FINAL) {
            view.put("winners", winners.stream().map(t -> t.index).toList());
            view.put("pointsEach", startCount / 2);
            view.put("standings", standings());
        }
        return view;
    }

    /** Winners first, then everyone else; names break ties. */
    private List<Map<String, Object>> standings() {
        List<Player> order = new ArrayList<>();
        teams.forEach(t -> order.addAll(t.players));
        order.sort((a, b) -> {
            int diff = earned.getOrDefault(b.getId(), 0) - earned.getOrDefault(a.getId(), 0);
            return diff != 0 ? diff : a.getName().compareToIgnoreCase(b.getName());
        });
        return order.stream().map(p -> {
            Map<String, Object> row = new LinkedHashMap<>(ref(p));
            row.put("points", earned.getOrDefault(p.getId(), 0));
            return row;
        }).toList();
    }

    @Override
    public Object hostView() {
        Map<String, Object> view = baseView();
        if (phase == Phase.ELECTION) {
            List<String> answered = new ArrayList<>();
            teams.forEach(t -> answered.addAll(t.votes.keySet()));
            view.put("answeredIds", answered);
        }
        return view;
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        Team team = teamOf(player);
        if (team == null) {
            return view;
        }
        view.put("yourTeam", team.index);
        view.put("isLeader", team.leader == player);
        if (team.pendingLeader != null) {
            view.put("pendingLeaderId", team.pendingLeader.getId());
        }
        if (phase == Phase.ELECTION && team.votes.containsKey(player.getId())) {
            view.put("yourVote", team.votes.get(player.getId()));
        }
        // Your own fleet is only shown while placing it (and to everyone at FINAL)
        if (phase == Phase.PLACE) {
            view.put("placement", shipsView(team));
        }
        if (phase == Phase.BOMB && team.target != null) {
            view.put("target", cell(team.target));
        }
        return view;
    }
}
