package com.bdvitz.codingstats.party.game;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** Game ids the host can start. Add new games here and in client/components/party/games/registry.tsx. */
public final class GameRegistry {

    public static final String DEFAULT_ID = ColorDilemmaGame.ID; // the main party game

    /** One lobby option: the values the host can pick and the one used when nothing was picked. */
    public record OptionSpec(List<Integer> allowed, int defaultValue) {}

    private static final Map<String, Supplier<PartyGame>> GAMES = Map.of(
            WarmupGame.ID, WarmupGame::new,
            StrikeoutGame.ID, StrikeoutGame::new,
            ColorDilemmaGame.ID, ColorDilemmaGame::new,
            MedianMadnessGame.ID, MedianMadnessGame::new,
            CardConundrumGame.ID, CardConundrumGame::new,
            BuoyantBattleGame.ID, BuoyantBattleGame::new
    );

    /** gameId -> option key -> spec. Keep in sync with `options` in the client registry. */
    private static final Map<String, Map<String, OptionSpec>> OPTIONS = Map.of(
            MedianMadnessGame.ID, Map.of(MedianMadnessGame.OPTION_TIME_LIMIT, new OptionSpec(List.of(30, 60), 60))
    );

    private GameRegistry() {}

    public static boolean exists(String id) {
        return id != null && GAMES.containsKey(id);
    }

    public static Optional<PartyGame> create(String id) {
        Supplier<PartyGame> factory = GAMES.get(id);
        return factory == null ? Optional.empty() : Optional.of(factory.get());
    }

    public static Map<String, OptionSpec> optionsFor(String id) {
        return OPTIONS.getOrDefault(id, Map.of());
    }

    public static boolean isValidOption(String id, String key, Integer value) {
        OptionSpec spec = optionsFor(id).get(key);
        return spec != null && value != null && spec.allowed().contains(value);
    }

    /** Every option of the game, using the chosen value when it's valid and the default otherwise. */
    public static Map<String, Integer> resolve(String id, Map<String, Integer> chosen) {
        Map<String, Integer> resolved = new LinkedHashMap<>();
        optionsFor(id).forEach((key, spec) -> {
            Integer value = chosen == null ? null : chosen.get(key);
            resolved.put(key, isValidOption(id, key, value) ? value : spec.defaultValue());
        });
        return resolved;
    }
}
