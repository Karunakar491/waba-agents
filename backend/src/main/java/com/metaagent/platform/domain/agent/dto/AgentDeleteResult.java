package com.metaagent.platform.domain.agent.dto;

import java.util.List;

/**
 * What actually happened during a full agent delete.
 *
 * Meta gives us no single "delete everything for this agent" call, so the
 * teardown is a sequence of per-resource deletes, each of which can fail on
 * its own. A failure does not stop the sequence — but it must not be hidden
 * either, or the operator believes Meta is clean when it isn't and reuses the
 * phone number on top of leftover config.
 *
 * {@code steps} describes only the Meta-side attempts. The local row is gone by
 * the time this is returned unless {@code preserved} is set, in which case the
 * agent was kept as a draft and {@code preserved} says what came with it.
 */
public record AgentDeleteResult(
        boolean metaFullyCleaned,
        List<Step> steps,
        DraftPreservation preserved
) {
    /**
     * What survived a preserve-as-draft delete. Null when the agent was deleted
     * outright.
     *
     * <p>Separate from {@code metaFullyCleaned} on purpose: that flag means "Meta
     * is clean", is logged as such, and the UI uses it to decide whether to show a
     * failure report. Overloading it to also mean "there is something to show the
     * operator" would make a successful preserve look like a failed teardown.
     */
    public record DraftPreservation(
            Long agentId,
            int faqsKept,
            int websitesKept,
            int filesDropped
    ) {}
    public record Step(String name, Status status, String detail) {
        public enum Status { SUCCEEDED, FAILED, SKIPPED }

        public static Step succeeded(String name, String detail) {
            return new Step(name, Status.SUCCEEDED, detail);
        }

        public static Step failed(String name, String detail) {
            return new Step(name, Status.FAILED, detail);
        }

        public static Step skipped(String name, String detail) {
            return new Step(name, Status.SKIPPED, detail);
        }
    }

    public static AgentDeleteResult of(List<Step> steps) {
        return of(steps, null);
    }

    public static AgentDeleteResult of(List<Step> steps, DraftPreservation preserved) {
        boolean clean = steps.stream().noneMatch(s -> s.status() == Step.Status.FAILED);
        return new AgentDeleteResult(clean, List.copyOf(steps), preserved);
    }
}
