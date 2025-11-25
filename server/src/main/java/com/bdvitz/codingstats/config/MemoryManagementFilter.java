package com.bdvitz.codingstats.config;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Filter to suggest garbage collection after API calls to help manage memory in constrained environments.
 * This is particularly useful for Railway's 500 MB memory limit.
 */
@Component
public class MemoryManagementFilter implements Filter {

    private static final Logger logger = LoggerFactory.getLogger(MemoryManagementFilter.class);
    private static final long GC_THRESHOLD_MB = 300; // Suggest GC if memory usage > 300 MB
    private static final long MIN_GC_INTERVAL_MS = 60000; // Don't GC more than once per minute
    private static long lastGcTime = 0;

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        String path = httpRequest.getRequestURI();

        // Process the request
        chain.doFilter(request, response);

        // After request completes, check if we should suggest GC
        // Only for API endpoints that might consume memory
        if (shouldSuggestGc(path)) {
            suggestGarbageCollection();
        }
    }

    /**
     * Determine if we should suggest GC based on the endpoint
     */
    private boolean shouldSuggestGc(String path) {
        // Suggest GC after memory-intensive operations
        return path.contains("/api/chess/stats/history") ||
               path.contains("/api/chess/stats/ratings-over-time") ||
               path.contains("/fetch-month-history");
    }

    /**
     * Suggest garbage collection if memory usage is high and enough time has passed
     */
    private void suggestGarbageCollection() {
        long currentTime = System.currentTimeMillis();

        // Don't GC too frequently
        if (currentTime - lastGcTime < MIN_GC_INTERVAL_MS) {
            return;
        }

        Runtime runtime = Runtime.getRuntime();
        long usedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);

        if (usedMemoryMB > GC_THRESHOLD_MB) {
            logger.info("Memory usage: {} MB. Suggesting garbage collection...", usedMemoryMB);
            System.gc();
            lastGcTime = currentTime;

            // Log memory after GC (give it a moment)
            try {
                Thread.sleep(100);
                long newUsedMemoryMB = (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024);
                logger.info("Memory after GC: {} MB (freed {} MB)", newUsedMemoryMB, usedMemoryMB - newUsedMemoryMB);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    @Override
    public void init(FilterConfig filterConfig) {
        logger.info("MemoryManagementFilter initialized for Railway memory optimization");
    }

    @Override
    public void destroy() {
        logger.info("MemoryManagementFilter destroyed");
    }
}
