package com.bdvitz.codingstats.party.game;

import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** Game ids the host can start. Add new games here and in client/components/party/games/registry.tsx. */
public final class GameRegistry {

    public static final String DEFAULT_ID = ColorDilemmaGame.ID; // the main party game

    private static final Map<String, Supplier<PartyGame>> GAMES = Map.of(
            WarmupGame.ID, WarmupGame::new,
            MostLikelyGame.ID, MostLikelyGame::new,
            ColorDilemmaGame.ID, ColorDilemmaGame::new
    );

    private GameRegistry() {}

    public static boolean exists(String id) {
        return id != null && GAMES.containsKey(id);
    }

    public static Optional<PartyGame> create(String id) {
        Supplier<PartyGame> factory = GAMES.get(id);
        return factory == null ? Optional.empty() : Optional.of(factory.get());
    }
}
