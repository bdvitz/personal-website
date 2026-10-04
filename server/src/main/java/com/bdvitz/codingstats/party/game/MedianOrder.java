package com.bdvitz.codingstats.party.game;

import java.util.ArrayList;
import java.util.List;

/**
 * Port of Bryan's median_order.py: the order in which values would be taken if the median were
 * repeatedly removed from a sorted list, rounding up (upper-middle) for even lengths.
 * Example: [0..6] -> [3, 4, 2, 5, 1, 6, 0]; [0..7] -> [4, 3, 5, 2, 6, 1, 7, 0].
 */
public final class MedianOrder {

    private MedianOrder() {}

    /** {@code sorted} must already be in ascending order. */
    public static <T> List<T> order(List<T> sorted) {
        int n = sorted.size();
        List<T> result = new ArrayList<>(n);
        int median = n / 2;
        // assign direction for future alternating offsets
        int direction = n % 2 == 1 ? -1 : 1;

        // Generate alternating offsets from median
        for (int offsetDoubled = 1; offsetDoubled <= n; offsetDoubled++) {
            result.add(sorted.get(median + direction * (offsetDoubled / 2)));
            direction *= -1;
        }
        return result;
    }
}
