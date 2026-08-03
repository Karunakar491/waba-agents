package com.metaagent.platform.support;

import com.metaagent.platform.domain.scheduler.GlobalSyncScheduler;
import com.metaagent.platform.infrastructure.claude.ClaudeApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.ThreadControlClient;
import com.redis.testcontainers.RedisContainer;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

/**
 * Base class for all integration tests.
 *
 * - Real MySQL via Testcontainers — no mocked DB (EL rule)
 * - Real Redis via Testcontainers — SecurityService uses Redis for lockout/session state
 * - MetaApiClient and ClaudeApiClient are @MockBean — never call real external APIs in tests
 * - Flyway runs all migrations on startup — schema is always production-equivalent
 * - NODE_ID set to 0 for tests — safe for single-node test environment
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@Testcontainers
public abstract class IntegrationTestBase {

    @Container
    static final MySQLContainer<?> mysql = new MySQLContainer<>("mysql:8.0")
            .withDatabaseName("metaagent_test")
            .withUsername("test")
            .withPassword("test")
            .withReuse(true); // reuse container across test classes for speed

    @Container
    static final RedisContainer redis = new RedisContainer(DockerImageName.parse("redis:7-alpine"))
            .withReuse(true); // reuse container across test classes for speed

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", mysql::getJdbcUrl);
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("spring.data.redis.host", redis::getHost);
        registry.add("spring.data.redis.port", () -> redis.getMappedPort(6379));
        registry.add("NODE_ID", () -> "0");
    }

    // External APIs — always mocked in tests
    @MockBean
    protected MetaApiClient metaApiClient;

    @MockBean
    protected ClaudeApiClient claudeApiClient;

    @MockBean
    protected ThreadControlClient threadControlClient;

    // GlobalSyncScheduler's @Scheduled cron methods (every 20 min / hourly)
    // are NOT profile-gated in production code (@EnableScheduling on
    // PlatformApplication is unconditional) — a long-running combined test
    // suite can genuinely cross one of those wall-clock boundaries mid-run.
    // When it fires for real, it calls businessAccountRepository.findAll()
    // across every account any test in the suite has created, then fans
    // out per-account work across metaSyncExecutor's up to 16 threads —
    // all competing with the tests' own JPA calls for the same small
    // HikariCP test pool. Confirmed live (2026-08-03): reproduced a
    // multi-hour hang, root-caused via thread dump to HikariCP pool
    // exhaustion with a live "scheduling-1" thread present. Mocking this
    // bean means Spring still "schedules" it, but each invocation calls a
    // Mockito no-op instead of the real fan-out.
    @MockBean
    protected GlobalSyncScheduler globalSyncScheduler;
}
