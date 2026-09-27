package com.bdvitz.codingstats.party.game;

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
import java.util.concurrent.ThreadLocalRandom;

/**
 * Throwaway test game that exercises both input types.
 * POLL (buttons, timed) -> POLL_REVEAL -> GUESS (integer, timed) -> GUESS_REVEAL -> FINAL.
 * Siding with the majority in the poll is worth 1 point; the closest guess is worth 2.
 * Players who don't answer before the deadline simply get no points for that round.
 */
public class WarmupGame implements PartyGame {

    public static final String ID = "warmup";

    private static final long POLL_MS = 20_000;
    private static final long GUESS_MS = 30_000;
    private static final long GUESS_MIN = 0;
    private static final long GUESS_MAX = 1_000_000;

    private enum Phase { POLL, POLL_REVEAL, GUESS, GUESS_REVEAL, FINAL }

    private record Poll(String prompt, List<String> options) {}
    private record Guess(String prompt, long answer) {}

    private static final List<Poll> POLLS = List.of(
            new Poll("Best pizza topping?", List.of("Pepperoni", "Mushroom", "Pineapple", "Plain cheese")),
            new Poll("Cats or dogs?", List.of("Cats", "Dogs")),
            new Poll("Morning person or night owl?", List.of("Morning person", "Night owl")),
            new Poll("Best kind of party game?", List.of("Trivia", "Drawing", "Bluffing"))
    );

    private static final List<Guess> GUESSES = List.of(
            new Guess("How many keys are on a standard piano?", 88),
            new Guess("In what year was the Rubik's Cube invented?", 1974),
            new Guess("How many squares of any size are on a chessboard?", 204),
            new Guess("How many bones are in the adult human body?", 206)
    );

    private final List<Player> participants = new ArrayList<>();
    private final Map<String, Integer> choices = new HashMap<>();
    private final Map<String, Long> guesses = new HashMap<>();
    private final Map<String, Integer> points = new HashMap<>();
    private final Set<String> pollWinners = new HashSet<>();
    private final Set<String> guessWinners = new HashSet<>();
    private Phase phase;
    private long deadline;
    private Poll poll;
    private Guess guess;
    private int[] tally;

    @Override
    public String id() {
        return ID;
    }

    @Override
    public void start(List<Player> players, long now) {
        participants.addAll(players);
        ThreadLocalRandom random = ThreadLocalRandom.current();
        poll = POLLS.get(random.nextInt(POLLS.size()));
        guess = GUESSES.get(random.nextInt(GUESSES.size()));
        phase = Phase.POLL;
        deadline = now + POLL_MS;
    }

    @Override
    public boolean onInput(Player player, JsonNode input, long now) {
        if (phase == Phase.POLL) {
            choices.put(player.getId(), PartyInputs.choice(input, poll.options().size()));
            if (allConnectedAnswered(choices.keySet())) {
                revealPoll();
            }
            return true;
        }
        if (phase == Phase.GUESS) {
            guesses.put(player.getId(), PartyInputs.number(input, GUESS_MIN, GUESS_MAX));
            if (allConnectedAnswered(guesses.keySet())) {
                revealGuess();
            }
            return true;
        }
        return false; // late answer after the timer: ignore
    }

    @Override
    public boolean onTick(long now) {
        if (deadline == 0 || now < deadline) {
            return false;
        }
        if (phase == Phase.POLL) {
            revealPoll();
            return true;
        }
        if (phase == Phase.GUESS) {
            revealGuess();
            return true;
        }
        return false;
    }

    @Override
    public boolean onAdvance(long now) {
        switch (phase) {
            case POLL -> revealPoll();
            case POLL_REVEAL -> {
                phase = Phase.GUESS;
                deadline = now + GUESS_MS;
            }
            case GUESS -> revealGuess();
            case GUESS_REVEAL -> phase = Phase.FINAL;
            default -> {
                return false;
            }
        }
        return true;
    }

    @Override
    public void onPlayerRemoved(Player player) {
        participants.remove(player);
        choices.remove(player.getId());
        guesses.remove(player.getId());
    }

    @Override
    public boolean isFinished() {
        return phase == Phase.FINAL;
    }

    private boolean allConnectedAnswered(Set<String> answered) {
        List<Player> connected = participants.stream().filter(Player::isConnected).toList();
        return !connected.isEmpty() && connected.stream().allMatch(p -> answered.contains(p.getId()));
    }

    private void revealPoll() {
        tally = new int[poll.options().size()];
        choices.values().forEach(i -> tally[i]++);
        int max = 0;
        for (int count : tally) {
            max = Math.max(max, count);
        }
        for (Player p : participants) {
            Integer choice = choices.get(p.getId());
            if (max > 0 && choice != null && tally[choice] == max) {
                pollWinners.add(p.getId());
                award(p, 1);
            }
        }
        phase = Phase.POLL_REVEAL;
        deadline = 0;
    }

    private void revealGuess() {
        long best = guesses.values().stream()
                .mapToLong(g -> Math.abs(g - guess.answer()))
                .min().orElse(Long.MAX_VALUE);
        for (Player p : participants) {
            Long g = guesses.get(p.getId());
            if (g != null && Math.abs(g - guess.answer()) == best) {
                guessWinners.add(p.getId());
                award(p, 2);
            }
        }
        phase = Phase.GUESS_REVEAL;
        deadline = 0;
    }

    private void award(Player player, int amount) {
        points.merge(player.getId(), amount, Integer::sum);
        player.addScore(amount);
    }

    // ---- views ----

    private Map<String, Object> baseView() {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("phase", phase.name());
        if (deadline > 0) {
            view.put("deadline", deadline);
        }
        switch (phase) {
            case POLL -> {
                view.put("prompt", poll.prompt());
                view.put("options", poll.options());
            }
            case POLL_REVEAL -> {
                view.put("prompt", poll.prompt());
                view.put("options", poll.options());
                view.put("tally", tally);
            }
            case GUESS -> {
                view.put("prompt", guess.prompt());
                view.put("min", GUESS_MIN);
                view.put("max", GUESS_MAX);
            }
            case GUESS_REVEAL -> {
                view.put("prompt", guess.prompt());
                view.put("answer", guess.answer());
                view.put("guesses", guessResults());
            }
            case FINAL -> view.put("standings", standings());
        }
        return view;
    }

    @Override
    public Object hostView() {
        Map<String, Object> view = baseView();
        if (phase == Phase.POLL || phase == Phase.GUESS) {
            Set<String> answered = phase == Phase.POLL ? choices.keySet() : guesses.keySet();
            view.put("answeredIds", new ArrayList<>(answered));
            view.put("participantIds", participants.stream().map(Player::getId).toList());
        }
        return view;
    }

    @Override
    public Object playerView(Player player) {
        Map<String, Object> view = baseView();
        String id = player.getId();
        switch (phase) {
            case POLL, POLL_REVEAL -> {
                if (choices.containsKey(id)) {
                    view.put("yourChoice", choices.get(id));
                }
                if (phase == Phase.POLL_REVEAL) {
                    view.put("youScored", pollWinners.contains(id));
                }
            }
            case GUESS, GUESS_REVEAL -> {
                if (guesses.containsKey(id)) {
                    view.put("yourGuess", guesses.get(id));
                }
                if (phase == Phase.GUESS_REVEAL) {
                    view.put("youScored", guessWinners.contains(id));
                }
            }
            default -> { }
        }
        return view;
    }

    private List<Map<String, Object>> guessResults() {
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Player p : participants) {
            Long g = guesses.get(p.getId());
            if (g == null) {
                continue;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("playerId", p.getId());
            row.put("name", p.getName());
            row.put("guess", g);
            row.put("winner", guessWinners.contains(p.getId()));
            rows.add(row);
        }
        rows.sort(Comparator.comparingLong(r -> Math.abs((Long) r.get("guess") - guess.answer())));
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
