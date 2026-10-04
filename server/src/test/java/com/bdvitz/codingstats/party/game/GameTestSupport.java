package com.bdvitz.codingstats.party.game;

import com.bdvitz.codingstats.party.model.Player;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Map;

/** Shared helpers for game unit tests. */
final class GameTestSupport {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private GameTestSupport() {}

    static Player player(String id) {
        Player p = new Player(id, "Name-" + id, "token-" + id);
        p.setConnected(true);
        return p;
    }

    static JsonNode choice(int index) {
        return MAPPER.createObjectNode().put("kind", "choice").put("index", index);
    }

    static JsonNode number(String value) {
        return MAPPER.createObjectNode().put("kind", "number").put("value", value);
    }

    static JsonNode target(String playerId) {
        return MAPPER.createObjectNode().put("kind", "target").put("playerId", playerId);
    }

    static JsonNode strike(String playerId, boolean on) {
        return MAPPER.createObjectNode().put("kind", "strike").put("playerId", playerId).put("on", on);
    }

    static JsonNode cell(int row, int col) {
        return MAPPER.createObjectNode().put("kind", "cell").put("row", row).put("col", col);
    }

    static JsonNode place(int ship, int row, int col, boolean vertical) {
        return MAPPER.createObjectNode().put("kind", "place").put("ship", ship).put("row", row).put("col", col).put("vertical", vertical);
    }

    static JsonNode confirm(boolean on) {
        return MAPPER.createObjectNode().put("kind", "confirm").put("on", on);
    }

    static JsonNode handoff(String playerId) {
        var node = MAPPER.createObjectNode().put("kind", "handoff");
        return playerId == null ? node : node.put("playerId", playerId);
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> view(Object view) {
        return (Map<String, Object>) view;
    }

    /** Round-trips a view through JSON, like the real broadcast does, so serialization bugs surface. */
    static JsonNode json(Object view) {
        return MAPPER.valueToTree(view);
    }
}
