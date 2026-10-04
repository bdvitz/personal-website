package com.bdvitz.codingstats.party.game;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MedianOrderTest {

    private static List<Integer> range(int n) {
        return IntStream.range(0, n).boxed().toList();
    }

    @Test
    void matchesThePythonScriptForOddAndEvenLengths() {
        assertEquals(List.of(3, 4, 2, 5, 1, 6, 0), MedianOrder.order(range(7)));
        assertEquals(List.of(4, 3, 5, 2, 6, 1, 7, 0), MedianOrder.order(range(8)));
    }

    @Test
    void smallLists() {
        assertEquals(List.of(), MedianOrder.order(range(0)));
        assertEquals(List.of(0), MedianOrder.order(range(1)));
        assertEquals(List.of(1, 0), MedianOrder.order(range(2)), "even length takes the upper middle first");
        assertEquals(List.of(1, 2, 0), MedianOrder.order(range(3)));
    }

    @Test
    void worksOnValuesNotJustIndexes() {
        assertEquals(List.of(42, 10, 77, 3), MedianOrder.order(List.of(3, 10, 42, 77)));
    }
}
