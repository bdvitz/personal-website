package com.bdvitz.codingstats.party.game;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PartyInputsTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static JsonNode json(String s) throws Exception {
        return MAPPER.readTree(s);
    }

    @Test
    void choiceAcceptsIndexesInRange() throws Exception {
        assertEquals(0, PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":0}"), 4));
        assertEquals(3, PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":3}"), 4));
    }

    @Test
    void choiceRejectsOutOfRangeNonIntegerAndWrongKind() {
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":4}"), 4));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":-1}"), 4));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":1.5}"), 4));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"choice\",\"index\":\"1\"}"), 4));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"choice\"}"), 4));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.choice(json("{\"kind\":\"number\",\"index\":1}"), 4));
    }

    @Test
    void numberAcceptsDigitStringsAndIntegers() throws Exception {
        assertEquals(42, PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"42\"}"), 0, 100));
        assertEquals(42, PartyInputs.number(json("{\"kind\":\"number\",\"value\":\" 42 \"}"), 0, 100));
        assertEquals(7, PartyInputs.number(json("{\"kind\":\"number\",\"value\":7}"), 0, 100));
        assertEquals(0, PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"0\"}"), 0, 100));
    }

    @Test
    void numberRejectsNonDigitsDecimalsAndOutOfRange() {
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"12a\"}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"\"}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":1.5}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"101\"}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":-1}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\",\"value\":\"99999999999999999999\"}"), 0, 100));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.number(json("{\"kind\":\"number\"}"), 0, 100));
    }

    @Test
    void targetRequiresPlayerId() throws Exception {
        assertEquals("p2", PartyInputs.target(json("{\"kind\":\"target\",\"playerId\":\"p2\"}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.target(json("{\"kind\":\"target\",\"playerId\":\"\"}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.target(json("{\"kind\":\"target\"}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.target(json("{\"kind\":\"choice\",\"playerId\":\"p2\"}")));
    }

    @Test
    void strikeAcceptsATargetAndABooleanState() throws Exception {
        assertEquals(new PartyInputs.Strike("p2", true), PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"p2\",\"on\":true}")));
        assertEquals(new PartyInputs.Strike("p2", false), PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"p2\",\"on\":false}")));
    }

    @Test
    void strikeRejectsMissingOrNonBooleanStateBlankIdAndWrongKind() {
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"p2\"}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"p2\",\"on\":\"true\"}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"p2\",\"on\":1}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.strike(json("{\"kind\":\"strike\",\"playerId\":\"\",\"on\":true}")));
        assertThrows(IllegalArgumentException.class, () -> PartyInputs.strike(json("{\"kind\":\"target\",\"playerId\":\"p2\",\"on\":true}")));
    }
}
