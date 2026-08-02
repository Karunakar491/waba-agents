package com.metaagent.platform.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

/**
 * Dedicated, bounded executor for parallel Meta-call fan-out (WabaService's
 * per-WABA phone fetch + per-agent status reconcile on Dashboard load).
 * Deliberately separate from the default @Async executor already used by
 * PhoneNumberSyncService/WebsiteCrawlService/EvalRollupWorker/ApiCallLogWriter
 * (Spring Boot's SimpleAsyncTaskExecutor, unbounded — fine for those, one
 * task per call) — a Dashboard load can fan out across several WABAs and
 * many agents at once, and an unbounded executor there is a real
 * thread-explosion risk under concurrent user load. Bounded here instead:
 * a full queue just makes the caller wait its turn rather than spawning an
 * unbounded number of threads against Meta.
 */
@Configuration
public class MetaSyncExecutorConfig {

    @Bean("metaSyncExecutor")
    public ThreadPoolTaskExecutor metaSyncExecutor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(8);
        executor.setMaxPoolSize(16);
        executor.setQueueCapacity(200);
        executor.setThreadNamePrefix("meta-sync-");
        executor.initialize();
        return executor;
    }
}
