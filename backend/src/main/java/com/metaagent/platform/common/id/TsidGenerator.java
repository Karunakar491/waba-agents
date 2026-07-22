package com.metaagent.platform.common.id;

import org.hibernate.engine.spi.SharedSessionContractImplementor;
import org.hibernate.id.IdentifierGenerator;

import java.time.Instant;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Generates sortable 64-bit IDs (TSID layout) without an external library.
 *
 * Bit layout (MSB → LSB):
 *   [42 bits] milliseconds since 2020-01-01 epoch  — sortable, ~139 years headroom
 *   [10 bits] node id from NODE_ID env var (0–1023)
 *   [12 bits] per-millisecond sequence             — 4096 IDs/ms per node
 *
 * Total: 64 bits, fits in a Java long / MySQL BIGINT UNSIGNED.
 *
 * NODE_ID must be set before the application starts (enforced in PlatformApplication).
 */
public class TsidGenerator implements IdentifierGenerator {

    // Custom epoch: 2020-01-01T00:00:00Z in ms since Unix epoch.
    // Using a recent epoch keeps the ms component small and maximises headroom.
    private static final long CUSTOM_EPOCH = 1577836800000L;

    private static final int  NODE_BITS     = 10;
    private static final int  SEQUENCE_BITS = 12;

    private static final long MAX_NODE_ID   = (1L << NODE_BITS) - 1;     // 1023
    private static final long MAX_SEQUENCE  = (1L << SEQUENCE_BITS) - 1;  // 4095

    private static final long NODE_SHIFT     = SEQUENCE_BITS;              // 12
    private static final long TIMESTAMP_SHIFT = NODE_BITS + SEQUENCE_BITS; // 22

    private static final long NODE_ID;

    static {
        String nodeEnv = System.getenv("NODE_ID");
        if (nodeEnv == null || nodeEnv.isBlank()) {
            // PlatformApplication asserts this before Spring context loads,
            // but guard here for tests that bypass the assertion.
            throw new IllegalStateException("NODE_ID environment variable must be set");
        }
        long parsed = Long.parseLong(nodeEnv.trim());
        if (parsed < 0 || parsed > MAX_NODE_ID) {
            throw new IllegalStateException(
                    "NODE_ID must be between 0 and " + MAX_NODE_ID + ", got: " + parsed);
        }
        NODE_ID = parsed;
    }

    // Shared mutable state across all generator invocations in this JVM.
    private static final AtomicInteger SEQUENCE = new AtomicInteger(0);
    private static volatile long lastTimestamp = -1L;

    @Override
    public Object generate(SharedSessionContractImplementor session, Object object) {
        return nextId();
    }

    /**
     * Returns the next TSID as a {@code Long}. Thread-safe.
     */
    public static Long nextId() {
        long timestamp = currentMs();

        // Sequence reset and clock regression handling.
        // Synchronize only on the rare path where timestamp == lastTimestamp.
        int seq;
        synchronized (TsidGenerator.class) {
            if (timestamp < lastTimestamp) {
                // Clock moved backwards — wait until we catch up.
                timestamp = lastTimestamp;
            }
            if (timestamp == lastTimestamp) {
                seq = SEQUENCE.incrementAndGet() & (int) MAX_SEQUENCE;
                if (seq == 0) {
                    // Sequence exhausted — spin until the next millisecond.
                    while (timestamp == lastTimestamp) {
                        timestamp = currentMs();
                    }
                }
            } else {
                SEQUENCE.set(0);
                seq = 0;
            }
            lastTimestamp = timestamp;
        }

        return ((timestamp - CUSTOM_EPOCH) << TIMESTAMP_SHIFT)
                | (NODE_ID << NODE_SHIFT)
                | seq;
    }

    private static long currentMs() {
        return Instant.now().toEpochMilli();
    }
}
