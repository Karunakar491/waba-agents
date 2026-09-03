package com.metaagent.platform.domain.agent.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.iris.AiToolSpec;
import com.metaagent.platform.domain.persona.repository.BusinessProfileRepository;
import com.metaagent.platform.domain.skill.dto.SkillDtos;
import com.metaagent.platform.domain.skill.service.SkillLibraryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AgentCreationToolProviderTest {

    private final AgentService agentService = mock(AgentService.class);
    private final BusinessProfileRepository businessProfileRepository = mock(BusinessProfileRepository.class);
    private final SkillLibraryService skillLibraryService = mock(SkillLibraryService.class);

    private AgentCreationToolProvider provider;

    @BeforeEach
    void setUp() {
        provider = new AgentCreationToolProvider(agentService, businessProfileRepository, skillLibraryService);
    }

    @Test
    void tools_containsExactlyCreateSkillRequiringConfirmation() {
        List<AiToolSpec> tools = provider.tools();

        assertThat(tools).hasSize(1);
        AiToolSpec createSkill = tools.get(0);
        assertThat(createSkill.name()).isEqualTo("create_skill");
        assertThat(createSkill.requiresConfirmation()).isTrue();
    }

    @Test
    void execute_createSkill_callsLibraryWithWabaFromAgent() {
        Long agentId = 42L;
        Long wabaId = 99L;
        Agent agent = Agent.builder().id(agentId).wabaId(wabaId).build();
        when(agentService.getAgent(agentId)).thenReturn(agent);
        SkillDtos.SkillResponse created = mock(SkillDtos.SkillResponse.class);
        when(skillLibraryService.createSkill(any())).thenReturn(created);

        Map<String, Object> result = provider.execute("create_skill", Map.of(
                "agentId", String.valueOf(agentId),
                "title", "Return Policy",
                "description", "How returns work",
                "body", "Quote the saved return policy."
        ), 1L);

        ArgumentCaptor<SkillDtos.CreateRequest> captor = ArgumentCaptor.forClass(SkillDtos.CreateRequest.class);
        verify(skillLibraryService).createSkill(captor.capture());
        SkillDtos.CreateRequest request = captor.getValue();
        assertThat(request.wabaId()).isEqualTo(String.valueOf(wabaId));
        assertThat(request.title()).isEqualTo("Return Policy");
        assertThat(request.description()).isEqualTo("How returns work");
        assertThat(request.body()).isEqualTo("Quote the saved return policy.");
        assertThat(result).containsEntry("skill", created);
    }

    @Test
    void execute_unknownTool_throwsBusinessException() {
        assertThatThrownBy(() -> provider.execute("not_a_tool", Map.of(), 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Unknown tool");
    }

    @Test
    void execute_createSkill_missingWaba_throwsBusinessException() {
        Long agentId = 7L;
        when(agentService.getAgent(agentId)).thenReturn(Agent.builder().id(agentId).wabaId(null).build());

        assertThatThrownBy(() -> provider.execute("create_skill", Map.of(
                "agentId", agentId,
                "title", "T",
                "description", "D",
                "body", "B"
        ), 1L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("WABA")
                .hasMessageContaining("connect");
    }
}
