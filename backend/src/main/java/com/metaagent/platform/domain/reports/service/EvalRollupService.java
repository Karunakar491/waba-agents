package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.common.security.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

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
    }

    public String start() {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        String jobId = UUID.randomUUID().toString();
        RollupJob job = new RollupJob();
        jobs.put(jobId, job);
        worker.runAsync(job, accountId);
        return jobId;
    }

    public Map<String, Object> poll(String jobId) {
        RollupJob job = jobs.get(jobId);
        if (job == null) {
            throw new NotFoundException("Rollup job not found");
        }
        double avg = job.results.stream()
                .filter(AgentEvalResult::ok)
                .filter(r -> r.avgConversationScore() != null)
                .mapToDouble(AgentEvalResult::avgConversationScore)
                .average()
                .orElse(0.0);
        return Map.of(
                "status", job.status,
                "completed", job.results.size(),
                "total", job.total,
                "avgConversationScore", avg,
                "results", job.results
        );
    }
}
