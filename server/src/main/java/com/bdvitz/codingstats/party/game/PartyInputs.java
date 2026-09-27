package com.bdvitz.codingstats.party.game;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Parsing and validation for the standard player inputs:
 * {@code {kind:"choice", index}}, {@code {kind:"number", value}}, {@code {kind:"target", playerId}}.
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

    private static void requireKind(JsonNode input, String expected) {
        if (!expected.equals(kind(input))) {
            throw new IllegalArgumentException("Unexpected input");
        }
    }
}
