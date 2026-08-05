package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Comparator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Account-wide eval rollup — fans out per-agent eval runs in parallel
 * (EvalRollupWorker) rather than a synchronous "call Meta once per agent,
 * wait for all" page load, which degrades linearly as an account's agent
 * count grows. One dead/slow phone number never fails the whole job
 * (per-agent timeout + try/catch, see EvalRollupWorker).
 *
 * No local persistence — job state lives in-memory only for the lifetime of
 * the rollup (short-TTL, single-instance; acceptable since this mirrors the
 * per-agent Eval tab's own "no persistence needed yet" reasoning, just
 * extended to cover the fan-out). If usage shows this needs to survive
 * restarts or scale across instances, that's the trigger to add a table —
 * not built speculatively now.
 */
@Service
@RequiredArgsConstructor
public class EvalRollupService {

    private final EvalRollupWorker worker;
    private final ConcurrentHashMap<String, RollupJob> jobs = new ConcurrentHashMap<>();

    public record AgentEvalResult(Long agentId, String agentName, boolean ok, Double avgConversationScore, String summary, String error) {}

    public static class RollupJob {
        volatile String status = "RUNNING"; // RUNNING | COMPLETED
        final CopyOnWriteArrayList<AgentEvalResult> results = new CopyOnWriteArrayList<>();
        volatile int total;
        Long accountId;
        Instant startedAt;
    }

    public String start() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        String jobId = UUID.randomUUID().toString();
        RollupJob job = new RollupJob();
        job.accountId = accountId;
        job.startedAt = Instant.now();
        jobs.put(jobId, job);
        worker.runAsync(job, accountId);
        return jobId;
    }

    public Map<String, Object> poll(String jobId) {
        RollupJob job = jobs.get(jobId);
        if (job == null) {
            throw new NotFoundException("Rollup job not found");
        }
        return toResponse(jobId, job);
    }

    /**
     * Most recent COMPLETED rollup for the current account, or null if none
     * has ever run (frontend renders an empty "run one" state, not a
     * spinner) — added 2026-08-05 so ReportsPage can show last-known results
     * on tab mount instead of requiring a manual "Run rollup" click every
     * single visit. In-memory only, same lifetime/scaling caveats as start().
     */
    public Map<String, Object> getLatestCompleted() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        return jobs.entrySet().stream()
                .filter(e -> accountId.equals(e.getValue().accountId))
                .filter(e -> "COMPLETED".equals(e.getValue().status))
                .max(Comparator.comparing(e -> e.getValue().startedAt))
                .map(e -> toResponse(e.getKey(), e.getValue()))
                .orElse(null);
    }

    private Map<String, Object> toResponse(String jobId, RollupJob job) {
        double avg = job.results.stream()
                .filter(AgentEvalResult::ok)
                .filter(r -> r.avgConversationScore() != null)
                .mapToDouble(AgentEvalResult::avgConversationScore)
                .average()
                .orElse(0.0);
        return Map.of(
                "jobId", jobId,
                "status", job.status,
                "completed", job.results.size(),
                "total", job.total,
                "avgConversationScore", avg,
                "results", job.results
        );
    }
}
