package com.metaagent.platform.common.id;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.net.URLClassLoader;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.LongStream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Pure JUnit 5 unit tests for TsidGenerator.
 *
 * Pre-requisite: The three positive tests require NODE_ID to be set before
 * the JVM starts, because TsidGenerator reads it in a static initializer.
 *
 * Maven Surefire configuration (pom.xml or surefire plugin config):
 *
 *   <configuration>
 *     <environmentVariables>
 *       <NODE_ID>1</NODE_ID>
 *     </environmentVariables>
 *   </configuration>
 *
 * If running directly in an IDE, set NODE_ID=1 in the run configuration's
 * environment variables before launching the test.
 */
class TsidGeneratorTest {

    /**
     * Guard: skip all tests in this class if NODE_ID is not set, rather than
     * crashing with an unhelpful ExceptionInInitializerError.
     *
     * The @BeforeAll here intentionally does NOT use System.setProperty because
     * TsidGenerator reads System.getenv — a property set via setProperty has
     * no effect on getenv. The variable must be present in the process environment
     * before the JVM starts.
     */
    @BeforeAll
    static void requireNodeIdEnv() {
        String nodeId = System.getenv("NODE_ID");
        org.junit.jupiter.api.Assumptions.assumeTrue(
                nodeId != null && !nodeId.isBlank(),
                "Skipping TsidGeneratorTest: NODE_ID environment variable is not set. " +
                "Set NODE_ID=1 in your run/test configuration."
        );
    }

    // ------------------------------------------------------------------
    // Positive tests (require NODE_ID to be set in the process environment)
    // ------------------------------------------------------------------

    @Test
    void should_generate_positive_long_id() {
        long id = TsidGenerator.nextId();

        assertTrue(id > 0, "Generated TSID must be a positive long, got: " + id);
    }

    @Test
    void should_generate_unique_ids_across_sequential_calls() {
        int count = 1000;
        Set<Long> ids = new HashSet<>(count);

        for (int i = 0; i < count; i++) {
            ids.add(TsidGenerator.nextId());
        }

        assertEquals(count, ids.size(),
                "Expected 1000 unique IDs across sequential calls, found duplicates");
    }

    @Test
    void should_generate_ids_in_ascending_order() {
        int count = 1000;
        long[] ids = new long[count];

        for (int i = 0; i < count; i++) {
            ids[i] = TsidGenerator.nextId();
        }

        for (int i = 1; i < count; i++) {
            assertTrue(ids[i] >= ids[i - 1],
                    "Expected IDs to be non-decreasing (time-sorted), but ids[%d]=%d < ids[%d]=%d"
                            .formatted(i, ids[i], i - 1, ids[i - 1]));
        }
    }

    // ------------------------------------------------------------------
    // Negative test — verifies static initializer guard when NODE_ID is absent
    //
    // Strategy: load TsidGenerator in a child URLClassLoader that inherits the
    // current classpath. Because the child loader has never seen TsidGenerator,
    // it will re-execute the static block. We cannot override System.getenv in
    // the child loader either, so this test is only meaningful when NODE_ID is
    // *not* set in the process environment.
    //
    // We therefore gate it with @DisabledIfEnvironmentVariable so it runs only
    // when NODE_ID is absent (i.e., in a separate test-phase run or CI matrix job
    // configured without NODE_ID). The test is still kept here for completeness
    // and documents the expected failure contract.
    //
    // To run this test in isolation:
    //   mvn test -Dtest=TsidGeneratorTest#should_throw_when_node_id_env_var_is_missing
    //   (do NOT set NODE_ID in the environment for that run)
    // ------------------------------------------------------------------

    /**
     * Verifies that loading TsidGenerator without NODE_ID set throws
     * an ExceptionInInitializerError wrapping an IllegalStateException.
     *
     * This test is disabled when NODE_ID is present in the environment because
     * the class will already be loaded (and successfully initialised) in the
     * same JVM. The child-ClassLoader trick below forces a fresh load, but it
     * still inherits System.getenv from the parent process — so NODE_ID being
     * present in the process environment makes the fresh load succeed, rendering
     * this test meaningless under those conditions.
     */
    @Test
    @org.junit.jupiter.api.condition.DisabledIfEnvironmentVariable(
            named = "NODE_ID",
            matches = ".*",
            disabledReason = "NODE_ID is set — class initialises successfully, " +
                             "cannot test the missing-env guard in the same JVM process"
    )
    void should_throw_when_node_id_env_var_is_missing() throws Exception {
        // Build a child ClassLoader that can see TsidGenerator but will
        // re-execute its static initializer for the first time in this loader.
        URLClassLoader childLoader = new URLClassLoader(
                ((URLClassLoader) ClassLoader.getSystemClassLoader()).getURLs(),
                null  // null parent → no delegation to system loader for TsidGenerator
        );

        // Loading the class triggers the static block.
        // With NODE_ID absent, it must throw ExceptionInInitializerError.
        ExceptionInInitializerError error = assertThrows(
                ExceptionInInitializerError.class,
                () -> childLoader.loadClass(TsidGenerator.class.getName())
        );

        Throwable cause = error.getCause();
        assertNotNull(cause, "ExceptionInInitializerError must have a cause");
        assertInstanceOf(IllegalStateException.class, cause,
                "Cause must be IllegalStateException, got: " + cause.getClass().getName());
        assertTrue(
                cause.getMessage().contains("NODE_ID"),
                "Exception message must mention NODE_ID, got: " + cause.getMessage()
        );

        childLoader.close();
    }
}
