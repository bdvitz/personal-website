package com.bdvitz.codingstats.party.game;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Parsing and validation for the standard player inputs:
 * {@code {kind:"choice", index}}, {@code {kind:"number", value}}, {@code {kind:"target", playerId}},
 * {@code {kind:"strike", ...}}, {@code {kind:"cell", ...}}, {@code {kind:"place", ...}}.
 */
public final class PartyInputs {

    private PartyInputs() {}

    public static String kind(JsonNode input) {
        return input.path("kind").asText("");
    }

    /** Index of a pressed button, 0 until optionCount - 1. */
    public static int choice(JsonNode input, int optionCount) {
        requireKind(input, "choice");
        JsonNode index = input.path("index");
        if (!index.canConvertToInt() || !index.isIntegralNumber()) {
            throw new IllegalArgumentException("Pick one of the options");
        }
        int value = index.asInt();
        if (value < 0 || value >= optionCount) {
            throw new IllegalArgumentException("Pick one of the options");
        }
        return value;
    }

    /** A whole number typed as digits. Accepts a JSON integer or a digit string. */
    public static long number(JsonNode input, long min, long max) {
        requireKind(input, "number");
        JsonNode node = input.path("value");
        long value;
        if (node.isIntegralNumber() && node.canConvertToLong()) {
            value = node.asLong();
        } else if (node.isTextual() && node.asText().trim().matches("-?\\d{1,15}")) {
            value = Long.parseLong(node.asText().trim());
        } else {
            throw new IllegalArgumentException("Enter a whole number");
        }
        if (value < min || value > max) {
            throw new IllegalArgumentException("Enter a number from " + min + " to " + max);
        }
        return value;
    }

    /** Another player's id, for games where players act on each other. Caller checks it exists. */
    public static String target(JsonNode input) {
        requireKind(input, "target");
        String id = input.path("playerId").asText("");
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Pick a player");
        }
        return id;
    }

    /** A wanted on/off state for one target ({@code {kind:"strike", playerId, on}}); idempotent, unlike a toggle. */
    public record Strike(String playerId, boolean on) {}

    public static Strike strike(JsonNode input) {
        requireKind(input, "strike");
        String id = input.path("playerId").asText("");
        if (id.isEmpty()) {
            throw new IllegalArgumentException("Pick a player");
        }
        JsonNode on = input.path("on");
        if (!on.isBoolean()) {
            throw new IllegalArgumentException("Unexpected input");
        }
        return new Strike(id, on.asBoolean());
    }

    /** A square on a size x size grid, 0-based ({@code {kind:"cell", row, col}}). */
    public record Cell(int row, int col) {}

    public static Cell cell(JsonNode input, int size) {
        requireKind(input, "cell");
        return new Cell(gridIndex(input.path("row"), size), gridIndex(input.path("col"), size));
    }

    /** A ship dropped with its top/left end on a square ({@code {kind:"place", ship, row, col, vertical}}). */
    public record Placement(int ship, int row, int col, boolean vertical) {}

    public static Placement place(JsonNode input, int size, int shipCount) {
        requireKind(input, "place");
        JsonNode ship = input.path("ship");
        if (!ship.isIntegralNumber() || ship.asInt() < 0 || ship.asInt() >= shipCount) {
            throw new IllegalArgumentException("Pick a ship");
        }
        JsonNode vertical = input.path("vertical");
        if (!vertical.isBoolean()) {
            throw new IllegalArgumentException("Unexpected input");
        }
        return new Placement(ship.asInt(), gridIndex(input.path("row"), size), gridIndex(input.path("col"), size), vertical.asBoolean());
    }

    private static int gridIndex(JsonNode node, int size) {
        if (!node.isIntegralNumber() || !node.canConvertToInt() || node.asInt() < 0 || node.asInt() >= size) {
            throw new IllegalArgumentException("Pick a square on the board");
        }
        return node.asInt();
    }

    private static void requireKind(JsonNode input, String expected) {
        if (!expected.equals(kind(input))) {
            throw new IllegalArgumentException("Unexpected input");
        }
    }
}
