package com.metaagent.platform.domain.reports.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentAccessService;
import com.metaagent.platform.domain.reports.service.EvalRollupService.AgentEvalResult;
import com.metaagent.platform.domain.reports.service.EvalRollupService.RollupJob;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

/**
 * Does the actual per-agent eval fan-out for EvalRollupService, off the
 * calling thread. Separated into its own bean (not a method on
 * EvalRollupService) so Spring's @Async proxy actually applies — a
 * self-invoked @Async method on the same class silently runs synchronously,
 * same bug class as the @Transactional private-method trap.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EvalRollupWorker {

    private static final long PER_AGENT_TIMEOUT_SECONDS = 25;
    private static final int POLL_ATTEMPTS = 10;
    private static final long POLL_INTERVAL_MS = 1500;

    private final AgentAccessService agentAccessService;
    private final MetaApiClient metaApiClient;

    @Async
    public void runAsync(RollupJob job, Long accountId) {
        List<Agent> agents = agentAccessService.listAccessible(accountId).stream()
                .filter(a -> a.getPhoneNumberId() != null)
                .toList();
        job.total = agents.size();

        List<CompletableFuture<Void>> futures = agents.stream()
                .map(agent -> CompletableFuture
                        .runAsync(() -> job.results.add(evalOneAgent(agent)))
                        .orTimeout(PER_AGENT_TIMEOUT_SECONDS, TimeUnit.SECONDS)
                        .exceptionally(e -> {
                            job.results.add(new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null,
                                    "Timed out or failed: " + e.getMessage()));
                            return null;
                        }))
                .toList();

        CompletableFuture.allOf(futures.toArray(new CompletableFuture[0])).join();
        job.status = "COMPLETED";
    }

    @SuppressWarnings("unchecked")
    private AgentEvalResult evalOneAgent(Agent agent) {
        try {
            Map<String, Object> cases = metaApiClient.get(
                    "/" + agent.getPhoneNumberId() + "/agent-eval/cases", Map.class);
            List<?> evalCases = cases != null && cases.get("eval_cases") instanceof List<?> l ? l : List.of();
            if (evalCases.isEmpty()) {
                return new AgentEvalResult(agent.getId(), agent.getDisplayName(), true, null, "No eval cases configured", null);
            }
            String caseIds = evalCases.stream()
                    .map(c -> c instanceof Map<?, ?> m ? String.valueOf(m.get("id")) : null)
                    .filter(java.util.Objects::nonNull)
                    .reduce((a, b) -> a + "," + b)
                    .orElse("");

            Map<String, Object> runResponse = metaApiClient.post(
                    "/" + agent.getPhoneNumberId() + "/agent-eval/run?eval_case_ids=" + caseIds, Map.of(), Map.class);
            String jobId = runResponse != null ? String.valueOf(runResponse.get("job_id")) : null;
            if (jobId == null) {
                return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, "Meta returned no job_id");
            }

            for (int i = 0; i < POLL_ATTEMPTS; i++) {
                Map<String, Object> status = metaApiClient.get(
                        "/" + agent.getPhoneNumberId() + "/agent-eval/run?job_id=" + jobId, Map.class);
                String state = status != null ? String.valueOf(status.get("status")) : "UNKNOWN";
                if ("COMPLETED".equals(state)) {
                    Map<?, ?> result = status.get("result") instanceof Map<?, ?> r ? r : Map.of();
                    Object avg = result.get("avg_conversation_score");
                    Object summary = result.get("summary");
                    return new AgentEvalResult(agent.getId(), agent.getDisplayName(), true,
                            avg instanceof Number n ? n.doubleValue() : null,
                            summary != null ? summary.toString() : null, null);
                }
                if ("FAILED".equals(state)) {
                    return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, "Eval run failed on Meta's side");
                }
                Thread.sleep(POLL_INTERVAL_MS);
            }
            return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, "Timed out waiting for Meta");
        } catch (MetaApiException e) {
            return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, "Meta error: " + e.getStatusCode());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, "Interrupted");
        } catch (Exception e) {
            log.warn("Eval rollup failed for agentId={}: {}", agent.getId(), e.getMessage());
            return new AgentEvalResult(agent.getId(), agent.getDisplayName(), false, null, null, e.getMessage());
        }
    }
}
