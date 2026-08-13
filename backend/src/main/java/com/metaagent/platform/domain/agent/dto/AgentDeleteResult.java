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
 * The local row is always gone by the time this is returned; {@code steps}
 * describes only the Meta-side attempts.
 */
public record AgentDeleteResult(
        boolean metaFullyCleaned,
        List<Step> steps
) {
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
        boolean clean = steps.stream().noneMatch(s -> s.status() == Step.Status.FAILED);
        return new AgentDeleteResult(clean, List.copyOf(steps));
    }
}
