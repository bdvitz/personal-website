# Railway Memory Optimization Guide

## Problem
Railway free tier provides **500 MB of RAM**, and the Spring Boot application was consuming **~450 MB**, leaving very little headroom.

## Solution Overview
We've implemented a multi-layered approach to reduce memory usage:

### 1. JVM Memory Limits (Procfile)
**Location**: `Procfile`

```bash
java -Xmx350m -Xms150m -XX:MaxMetaspaceSize=90m -XX:MetaspaceSize=64m -XX:+UseSerialGC ...
```

**Key Settings**:
- `-Xmx350m`: Maximum heap size of 350 MB (down from unlimited)
- `-Xms150m`: Initial heap size of 150 MB (reduces initial footprint)
- `-XX:MaxMetaspaceSize=90m`: Limit class metadata to 90 MB
- `-XX:+UseSerialGC`: Use Serial GC (lower memory overhead than G1GC)
- `-XX:MinHeapFreeRatio=20`: Keep less free heap memory
- `-XX:MaxHeapFreeRatio=40`: More aggressive heap shrinking
- `-XX:GCTimeRatio=4`: Allow more GC time (20% instead of 1%)

**Expected Memory Breakdown**:
- Heap: ~200-350 MB
- Metaspace: ~60-90 MB
- Thread stacks + native: ~50-60 MB
- **Total: ~350-450 MB** (within 500 MB limit with headroom)

### 2. Database Connection Pool (application.properties)
**Reduced HikariCP settings**:
```properties
spring.datasource.hikari.maximum-pool-size=3      # Was 5
spring.datasource.hikari.minimum-idle=1           # Was 2
```

**Memory Savings**: ~10-20 MB
- Each idle connection uses ~3-5 MB
- Reduced from 5 connections to 3 maximum

### 3. Tomcat Thread Pool
**Reduced worker threads**:
```properties
server.tomcat.threads.max=20                      # Was 50
server.tomcat.threads.min-spare=5                 # Was 10
server.tomcat.max-connections=20                  # Was 50
```

**Memory Savings**: ~30-60 MB
- Each thread uses ~1-2 MB for stack space
- Reduced from 50 threads to 20 maximum

### 4. Disabled Features
```properties
spring.jmx.enabled=false                          # Disable JMX monitoring
management.metrics.enable.jvm=false               # Disable JVM metrics
management.metrics.enable.process=false           # Disable process metrics
management.metrics.enable.system=false            # Disable system metrics
spring.jpa.properties.hibernate.cache.use_second_level_cache=false
spring.jpa.properties.hibernate.cache.use_query_cache=false
```

**Memory Savings**: ~20-40 MB
- JMX beans and metrics collection have overhead
- Hibernate caches disabled (we don't need them for this use case)

### 5. Automatic Garbage Collection Filter
**Location**: `src/main/java/com/bdvitz/codingstats/config/MemoryManagementFilter.java`

This filter monitors memory usage and suggests garbage collection after memory-intensive API calls.

**How it works**:
1. Monitors memory usage after API requests
2. If memory > 300 MB, suggests GC (via `System.gc()`)
3. Rate-limited to once per minute to avoid performance issues
4. Targets high-memory endpoints:
   - `/api/chess/stats/history`
   - `/api/chess/stats/ratings-over-time`
   - `/fetch-month-history`

**Benefits**:
- Proactively frees memory after large operations
- Prevents slow memory buildup over time
- Particularly helpful for endpoints that process large datasets

### 6. Hibernate Batch Optimizations
```properties
spring.jpa.properties.hibernate.jdbc.batch_size=10
spring.jpa.properties.hibernate.order_inserts=true
spring.jpa.properties.hibernate.order_updates=true
```

**Benefits**:
- Reduces memory needed to hold pending database operations
- Batches operations efficiently

## Memory Usage Expectations

### Before Optimization
- **Base memory**: ~450 MB
- **Peak memory**: ~480+ MB (risky with 500 MB limit)
- **Headroom**: 20-50 MB (not enough!)

### After Optimization
- **Base memory**: ~250-300 MB
- **Peak memory**: ~350-400 MB
- **Headroom**: 100-150 MB (much safer!)

## Performance Trade-offs

These optimizations **reduce performance** but are necessary for the memory constraint:

1. **Fewer threads** (20 vs 50):
   - Can handle fewer concurrent requests
   - Fine for personal website with low traffic

2. **Fewer DB connections** (3 vs 5):
   - Requests may wait for connections during high load
   - Acceptable for low-traffic use case

3. **Serial GC** instead of G1GC:
   - Longer GC pause times (10-50ms vs 1-5ms)
   - Lower throughput
   - But uses ~20-30 MB less memory

4. **More frequent GC**:
   - Slightly higher CPU usage
   - But prevents memory buildup

## Monitoring Memory Usage

### On Railway:
1. Check Railway dashboard metrics
2. Look for memory spikes
3. Watch for OOM (Out of Memory) errors

### Add logging to track memory:
The `MemoryManagementFilter` already logs:
```
Memory usage: 320 MB. Suggesting garbage collection...
Memory after GC: 280 MB (freed 40 MB)
```

### Manual memory check endpoint (optional):
You could add a controller to check memory status:
```java
@GetMapping("/api/admin/memory-status")
public Map<String, Long> getMemoryStatus() {
    Runtime runtime = Runtime.getRuntime();
    return Map.of(
        "totalMemoryMB", runtime.totalMemory() / (1024 * 1024),
        "freeMemoryMB", runtime.freeMemory() / (1024 * 1024),
        "usedMemoryMB", (runtime.totalMemory() - runtime.freeMemory()) / (1024 * 1024),
        "maxMemoryMB", runtime.maxMemory() / (1024 * 1024)
    );
}
```

## Deployment Checklist

When deploying to Railway:

- [x] **Procfile** is in `server/` directory
- [x] **application.properties** has memory optimizations
- [x] **MemoryManagementFilter** is present
- [ ] Set `MAVEN_OPTS` in Railway environment variables (optional):
  ```
  MAVEN_OPTS=-Xmx256m -Xms128m
  ```
- [ ] Monitor Railway logs for memory warnings
- [ ] Check for `OutOfMemoryError` in logs

## Further Optimizations (if needed)

If you still see memory issues:

1. **Reduce max heap further**:
   ```bash
   -Xmx300m  # Instead of 350m
   ```

2. **Disable lazy initialization**:
   ```properties
   spring.main.lazy-initialization=false
   ```
   This may actually help by loading classes once instead of on-demand.

3. **Disable DevTools in production** (should already be disabled):
   DevTools should only run in development mode.

4. **Use native compilation** (advanced):
   GraalVM native image uses ~50-100 MB instead of 300-400 MB, but requires significant build changes.

## Troubleshooting

### "OutOfMemoryError: Java heap space"
- Increase `-Xmx` by 50 MB
- Check for memory leaks in custom code
- Review query sizes (limit large result sets)

### "OutOfMemoryError: Metaspace"
- Increase `-XX:MaxMetaspaceSize=120m`
- Review number of loaded classes

### App crashes on Railway
- Check Railway logs for OOM errors
- Reduce `-Xmx` to give more room for native memory
- Consider reducing thread count further

## Summary

With these optimizations, your Spring Boot app should comfortably run within Railway's 500 MB limit while maintaining acceptable performance for a personal website.

**Estimated memory reduction**: 150-200 MB
**Expected memory usage**: 250-400 MB (was 450+ MB)
**Headroom**: 100-250 MB (was 0-50 MB)
