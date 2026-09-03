package com.metaagent.platform.domain.agent.service;

import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.entity.AgentFaq;
import com.metaagent.platform.domain.agent.entity.AgentSkill;
import com.metaagent.platform.domain.agent.entity.AgentUiSkill;
import com.metaagent.platform.domain.agent.repository.AgentFaqRepository;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.repository.AgentSkillRepository;
import com.metaagent.platform.domain.agent.repository.AgentUiSkillRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Completes the soft-transition side of Unpublish: {@link AgentService}'s
 * unpublishSkill/unpublishUiSkill/unpublishFaq flip a row to draft
 * immediately (so BizAI stops being told about it right away) but never
 * touch Meta directly — an in-flight conversation turn could otherwise lose
 * a skill mid-response. This job is the delayed half: once a row has sat in
 * draft past the grace window, it actually deletes the Meta record and
 * clears metaSkillId (storing it on previousMetaSkillId first, audit only —
 * Meta has no "undo delete", so Republish always creates a new id).
 *
 * Runs frequently (short grace window) since the whole point is deleting
 * soon after the grace period, not batching for efficiency — these are
 * low-cardinality per agent, same reasoning as the deleteAgent cascade.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SkillUnpublishSweepJob {

    private final AgentSkillRepository agentSkillRepository;
    private final AgentUiSkillRepository agentUiSkillRepository;
    private final AgentFaqRepository agentFaqRepository;
    private final AgentRepository agentRepository;
    private final MetaApiClient metaApiClient;

    @Value("${skills.unpublish.grace-seconds:10}")
    private int graceSeconds;

    /** Kill switch (DevOps gate requirement) — this job is the only genuinely
     * new runtime behavior in this release; flip to false and restart to
     * disable it without a redeploy if it ever misbehaves against real rows. */
    @Value("${skills.unpublish.sweep.enabled:true}")
    private boolean sweepEnabled;

    @Scheduled(fixedDelay = 15000)
    @Transactional
    public void sweep() {
        if (!sweepEnabled) {
            return;
        }
        LocalDateTime cutoff = LocalDateTime.now().minusSeconds(graceSeconds);
        sweepSkills(cutoff);
        sweepUiSkills(cutoff);
        sweepFaqs(cutoff);
    }

    private void sweepSkills(LocalDateTime cutoff) {
        List<AgentSkill> due = agentSkillRepository
                .findAllByStatusAndUnpublishedAtBeforeAndMetaSkillIdIsNotNull(AgentSkill.Status.draft, cutoff);
        for (AgentSkill skill : due) {
            agentRepository.findById(skill.getAgentId()).ifPresent(agent -> {
                try {
                    String path = MetaApiClient.scopedPath(
                            String.format("/%s/agent_config/skills/%s", agent.getPhoneNumberId(), skill.getMetaSkillId()),
                            agent.getMetaAgentId());
                    metaApiClient.delete(path);
                } catch (Exception e) {
                    log.warn("Unpublish sweep: failed to delete skill from Meta, will retry next sweep. skillId={} error={}",
                            skill.getId(), e.getMessage());
                    return;
                }
                skill.setPreviousMetaSkillId(skill.getMetaSkillId());
                skill.setMetaSkillId(null);
                agentSkillRepository.save(skill);
            });
        }
    }

    private void sweepUiSkills(LocalDateTime cutoff) {
        List<AgentUiSkill> due = agentUiSkillRepository
                .findAllByPublishStatusAndUnpublishedAtBeforeAndMetaUiSkillIdIsNotNull(AgentUiSkill.PublishStatus.draft, cutoff);
        for (AgentUiSkill skill : due) {
            agentRepository.findById(skill.getAgentId()).ifPresent(agent -> {
                try {
                    metaApiClient.delete("/" + agent.getPhoneNumberId() + "/agent-ui-skills/" + skill.getMetaUiSkillId());
                } catch (Exception e) {
                    log.warn("Unpublish sweep: failed to delete UI skill from Meta, will retry next sweep. uiSkillId={} error={}",
                            skill.getId(), e.getMessage());
                    return;
                }
                skill.setPreviousMetaUiSkillId(skill.getMetaUiSkillId());
                skill.setMetaUiSkillId(null);
                agentUiSkillRepository.save(skill);
            });
        }
    }

    private void sweepFaqs(LocalDateTime cutoff) {
        List<AgentFaq> due = agentFaqRepository
                .findAllByStatusAndUnpublishedAtBeforeAndMetaFaqIdIsNotNull(AgentFaq.Status.draft, cutoff);
        for (AgentFaq faq : due) {
            Agent agent = agentRepository.findById(faq.getAgentId()).orElse(null);
            if (agent == null || agent.getPhoneNumberId() == null) {
                continue;
            }
            try {
                metaApiClient.delete(String.format("/%s/agent_config/faq/%s", agent.getPhoneNumberId(), faq.getMetaFaqId()));
            } catch (Exception e) {
                log.warn("Unpublish sweep: failed to delete FAQ from Meta, will retry next sweep. faqId={} error={}",
                        faq.getId(), e.getMessage());
                continue;
            }
            faq.setPreviousMetaFaqId(faq.getMetaFaqId());
            faq.setMetaFaqId(null);
            faq.setMetaSynced(false);
            agentFaqRepository.save(faq);
        }
    }
}
