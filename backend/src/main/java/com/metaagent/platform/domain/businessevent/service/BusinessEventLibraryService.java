package com.metaagent.platform.domain.businessevent.service;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.CreateOrUpdateRequest;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.DeleteImpact;
import com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos.EventListItem;
import com.metaagent.platform.domain.businessevent.entity.BusinessEvent;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventBinding;
import com.metaagent.platform.domain.businessevent.entity.BusinessEventFire;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventBindingRepository;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventFireRepository;
import com.metaagent.platform.domain.businessevent.repository.BusinessEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * The library layer: create once, attach to many agents. Mirrors
 * {@code SkillLibraryService}'s shape on purpose (the founder's own
 * instruction, R8 Q9) — one editor, one list, shared across the nav, the
 * agent tab and the wizard.
 */
@Service
@RequiredArgsConstructor
public class BusinessEventLibraryService {

    private final BusinessEventRepository eventRepository;
    private final BusinessEventBindingRepository bindingRepository;
    private final BusinessEventFireRepository fireRepository;
    private final AgentRepository agentRepository;

    /** The nav-wide list — every event this account owns, "used by N agents". */
    @Transactional(readOnly = true)
    public List<EventListItem> listForAccount(Long accountId) {
        List<BusinessEvent> events = eventRepository.findAllByAccountIdOrderByNameAsc(accountId);
        Map<Long, Long> usage = usageCounts(events.stream().map(BusinessEvent::getId).toList());
        return events.stream()
                .map(e -> toListItem(e, usage.getOrDefault(e.getId(), 0L), null, false))
                .toList();
    }

    /** The agent-page list — same rows, "last fired" instead of a count, and which are attached. */
    @Transactional(readOnly = true)
    public List<EventListItem> listForAgent(Long agentId, Long accountId) {
        List<BusinessEvent> events = eventRepository.findAllByAccountIdOrderByNameAsc(accountId);
        List<BusinessEventBinding> bindings = bindingRepository.findAllByAgentId(agentId);
        var attachedEventIds = bindings.stream().map(BusinessEventBinding::getBusinessEventId)
                .collect(Collectors.toSet());
        return events.stream()
                .map(e -> {
                    var lastFired = attachedEventIds.contains(e.getId())
                            ? fireRepository.findTopByAgentIdAndBusinessEventIdOrderByCreatedAtDesc(agentId, e.getId())
                                    .map(BusinessEventFire::getCreatedAt)
                                    .orElse(null)
                            : null;
                    return toListItem(e, 0L, lastFired, attachedEventIds.contains(e.getId()));
                })
                .toList();
    }

    @Transactional
    public EventListItem create(Long accountId, Long userId, CreateOrUpdateRequest req) {
        validate(req);
        BusinessEvent event = BusinessEvent.builder()
                .accountId(accountId)
                .name(req.name().trim())
                .description(req.description().trim())
                .guardrails(blankToNull(req.guardrails()))
                .triggerMethod(com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos
                        .parseTriggerMethod(req.triggerMethod()))
                .createdBy(userId)
                .build();
        event = eventRepository.save(event);
        return toListItem(event, 0L, null, false);
    }

    @Transactional
    public EventListItem update(Long accountId, Long eventId, CreateOrUpdateRequest req) {
        validate(req);
        BusinessEvent event = eventRepository.findByIdAndAccountId(eventId, accountId)
                .orElseThrow(() -> new BusinessException("Business event not found"));
        event.setName(req.name().trim());
        event.setDescription(req.description().trim());
        event.setGuardrails(blankToNull(req.guardrails()));
        event.setTriggerMethod(com.metaagent.platform.domain.businessevent.dto.BusinessEventLibraryDtos
                .parseTriggerMethod(req.triggerMethod()));
        event = eventRepository.save(event);
        long usedBy = bindingRepository.findAllByBusinessEventId(eventId).size();
        return toListItem(event, usedBy, null, false);
    }

    /** What deleting this would break — checked first, always, never discovered after the fact. */
    @Transactional(readOnly = true)
    public DeleteImpact previewDelete(Long accountId, Long eventId) {
        eventRepository.findByIdAndAccountId(eventId, accountId)
                .orElseThrow(() -> new BusinessException("Business event not found"));
        List<BusinessEventBinding> bindings = bindingRepository.findAllByBusinessEventId(eventId);
        if (bindings.isEmpty()) {
            return new DeleteImpact(false, List.of());
        }
        var agentIds = bindings.stream().map(BusinessEventBinding::getAgentId).toList();
        var names = agentRepository.findAllById(agentIds).stream()
                .map(Agent::getDisplayName)
                .sorted()
                .toList();
        return new DeleteImpact(true, names);
    }

    /** Only called after the operator has seen {@link #previewDelete} and confirmed. */
    @Transactional
    public void delete(Long accountId, Long eventId) {
        BusinessEvent event = eventRepository.findByIdAndAccountId(eventId, accountId)
                .orElseThrow(() -> new BusinessException("Business event not found"));
        bindingRepository.deleteAll(bindingRepository.findAllByBusinessEventId(eventId));
        eventRepository.delete(event);
    }

    @Transactional
    public void attach(Long accountId, Long agentId, Long eventId) {
        eventRepository.findByIdAndAccountId(eventId, accountId)
                .orElseThrow(() -> new BusinessException("Business event not found"));
        if (bindingRepository.findByAgentIdAndBusinessEventId(agentId, eventId).isPresent()) {
            return; // already attached — attaching twice is a no-op, not an error
        }
        bindingRepository.save(BusinessEventBinding.builder().agentId(agentId).businessEventId(eventId).build());
    }

    @Transactional
    public void detach(Long accountId, Long agentId, Long eventId) {
        eventRepository.findByIdAndAccountId(eventId, accountId)
                .orElseThrow(() -> new BusinessException("Business event not found"));
        bindingRepository.findByAgentIdAndBusinessEventId(agentId, eventId)
                .ifPresent(bindingRepository::delete);
    }

    private Map<Long, Long> usageCounts(List<Long> eventIds) {
        if (eventIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Long> counts = new HashMap<>();
        for (Object[] row : bindingRepository.countByBusinessEventIdIn(eventIds)) {
            counts.put((Long) row[0], (Long) row[1]);
        }
        return counts;
    }

    private static EventListItem toListItem(BusinessEvent e, long usedByCount,
                                             java.time.LocalDateTime lastFiredAt, boolean attached) {
        return new EventListItem(
                e.getId(), e.getName(), e.getDescription(), e.getGuardrails(),
                e.getTriggerMethod().name(), usedByCount, lastFiredAt, attached);
    }

    private static void validate(CreateOrUpdateRequest req) {
        if (req.name() == null || req.name().isBlank()) {
            throw new BusinessException("Name is required");
        }
        if (req.name().trim().length() > 64) {
            throw new BusinessException("Name must be 64 characters or fewer");
        }
        if (req.description() == null || req.description().isBlank()) {
            throw new BusinessException("Description is required");
        }
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
