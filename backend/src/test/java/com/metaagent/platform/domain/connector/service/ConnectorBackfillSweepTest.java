package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.connector.entity.Connector;
import com.metaagent.platform.domain.connector.entity.ConnectorAction;
import com.metaagent.platform.domain.connector.entity.ConnectorDeployment;
import com.metaagent.platform.domain.connector.repository.ConnectorActionRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorRepository;
import com.metaagent.platform.infrastructure.meta.MetaApiClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestClient;

import java.lang.reflect.Proxy;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The parts of the sweep that WRITE, covered without a mocking framework.
 *
 * No Mockito, by instruction. The repositories are JPA interfaces with ~20
 * inherited methods, so they are answered by a reflection proxy that only
 * knows the handful this service calls; MetaApiClient is subclassed. What
 * matters is that the PAYLOADS are the ones production actually returned, not
 * invented shapes — fabricated fixtures are what let the previous version of
 * this code look correct while being unable to fire at all.
 *
 * Written after the EL gate rejected the first version: the "connector is gone
 * from Meta" branch keyed off a 404 on the per-connector tools call, so it
 * could never fire for a connector missing from Meta's list — which is the
 * only way a connector actually goes missing. One test over the loop would
 * have caught it, and did not exist.
 */
class ConnectorBackfillSweepTest {

    private static final Long AGENT_ID = 900L;
    private static final Long CONNECTOR_ID = 5L;
    private static final String LIVE_ID = "pfbid0live";
    private static final String DELETED_ID = "pfbid0deleted";

    /** Verbatim from GET /{pn}/agent_connectors/{id}/tools for IndiaMART, 2026-09-20. */
    private static final Map<String, Object> REAL_TOOL = Map.of(
            "id", "pfbid0tool",
            "name", "product_search",
            "description", "Search IndiaMART for suppliers of a product in a city.",
            "user_auth_required", false,
            "request_definition", Map.of("method", "POST", "path", "/",
                    "body", Map.of("content_type", "application/json")));

    // -------------------------------------------------------------------------
    // Stubs — no framework
    // -------------------------------------------------------------------------

    /** Answers the list call and the tools call; records every path requested. */
    private static class StubMeta extends MetaApiClient {
        final List<String> paths = new ArrayList<>();
        private final List<?> connectors;
        private final List<?> tools;

        StubMeta(List<?> connectors, List<?> tools) {
            super(RestClient.builder(), "http://meta.test", "token", "v1", "http://graph.test", "v1", null);
            this.connectors = connectors;
            this.tools = tools;
        }

        @Override
        @SuppressWarnings("unchecked")
        public <T> T get(String path, Class<T> responseType) {
            paths.add(path);
            return (T) (path.contains("/tools") ? tools : connectors);
        }
    }

    @SuppressWarnings("unchecked")
    private static <T> T stubRepo(Class<T> type, Map<String, Object> answers, List<Object> saved) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, (p, method, args) -> {
            if ("save".equals(method.getName())) {
                saved.add(args[0]);
                return args[0];
            }
            Object answer = answers.get(method.getName());
            if (answer != null) return answer;
            // Anything this service does not call should fail loudly rather
            // than quietly returning null and passing a test for the wrong reason.
            if (method.getReturnType() == boolean.class) return false;
            if (method.getReturnType() == Optional.class) return Optional.empty();
            if (List.class.isAssignableFrom(method.getReturnType())) return List.of();
            return null;
        });
    }

    private Agent agent() {
        Agent agent = Agent.builder().accountId(1L).phoneNumberId("104605124").metaAgentId("pfbid0agent").build();
        agent.setId(AGENT_ID);
        agent.setWabaId(77L);
        return agent;
    }

    private Connector connector() {
        Connector c = Connector.builder().accountId(1L).name("IndiaMART Product Search API")
                .description("d").baseUrl("https://api.example.com").authType("NONE").build();
        c.setId(CONNECTOR_ID);
        return c;
    }

    private ConnectorDeployment deployedAgainst(String metaId) {
        return ConnectorDeployment.builder()
                .connectorId(CONNECTOR_ID).agentId(AGENT_ID).metaConnectorId(metaId)
                .deployedAt(LocalDateTime.now().minusDays(1)).build();
    }

    private record Rig(ConnectorBackfillService service, StubMeta meta,
                       List<Object> savedActions, List<Object> savedDeployments) {}

    private Rig rig(List<?> metaConnectors, List<?> metaTools, ConnectorDeployment deployment, boolean enabled) {
        List<Object> savedActions = new ArrayList<>();
        List<Object> savedDeployments = new ArrayList<>();
        StubMeta meta = new StubMeta(metaConnectors, metaTools);
        ConnectorBackfillService service = new ConnectorBackfillService(
                stubRepo(ConnectorRepository.class, Map.of("findById", Optional.of(connector())), new ArrayList<>()),
                stubRepo(ConnectorActionRepository.class,
                        Map.of("findAllByConnectorIdOrderByNameAsc", List.of()), savedActions),
                stubRepo(ConnectorDeploymentRepository.class,
                        Map.of("findAllByAgentIdIn", List.of(deployment)), savedDeployments),
                meta, new ObjectMapper());
        ReflectionTestUtils.setField(service, "enabled", enabled);
        return new Rig(service, meta, savedActions, savedDeployments);
    }

    // -------------------------------------------------------------------------

    @Test
    void should_import_the_tools_of_a_connector_meta_still_lists() {
        Rig rig = rig(List.of(Map.of("id", LIVE_ID)), List.of(REAL_TOOL), deployedAgainst(LIVE_ID), true);

        rig.service().ensureConnectorsBackfilled(agent());

        assertEquals(1, rig.savedActions().size());
        assertEquals("product_search", ((ConnectorAction) rig.savedActions().get(0)).getName());
        // Counts written once, after the loop.
        assertEquals(1, rig.savedDeployments().size());
        ConnectorDeployment after = (ConnectorDeployment) rig.savedDeployments().get(0);
        assertEquals(1, after.getToolsReportedByMeta());
        assertEquals(1, after.getToolsImported());
        assertNotNull(after.getDeployedAt(), "a connector Meta still lists stays published");
    }

    /**
     * The case the first version could not reach. Our row says deployed against
     * DELETED_ID; Meta's list does not contain it.
     */
    @Test
    void should_mark_a_connector_meta_no_longer_lists_as_not_published() {
        ConnectorDeployment gone = deployedAgainst(DELETED_ID);
        Rig rig = rig(List.of(Map.of("id", LIVE_ID)), List.of(), gone, true);

        rig.service().ensureConnectorsBackfilled(agent());

        assertNull(gone.getDeployedAt(), "published means published to Meta — Meta does not have this");
        assertNotNull(gone.getLastError());
        assertTrue(rig.savedDeployments().contains(gone));
        // And it must not have gone looking for tools on something Meta does not list.
        assertTrue(rig.meta().paths.stream().noneMatch(p -> p.contains("/tools")));
    }

    @Test
    void should_leave_everything_alone_when_meta_returns_nothing() {
        // An outage must never read as a mass deletion.
        ConnectorDeployment untouched = deployedAgainst(LIVE_ID);
        Rig rig = rig(null, List.of(), untouched, true);

        rig.service().ensureConnectorsBackfilled(agent());

        assertNotNull(untouched.getDeployedAt());
        assertTrue(rig.savedDeployments().isEmpty());
    }

    @Test
    void should_do_nothing_at_all_when_the_kill_switch_is_off() {
        Rig rig = rig(List.of(Map.of("id", LIVE_ID)), List.of(REAL_TOOL), deployedAgainst(LIVE_ID), false);

        rig.service().ensureConnectorsBackfilled(agent());

        assertTrue(rig.meta().paths.isEmpty(), "the flag must stop it before it reaches Meta");
        assertTrue(rig.savedActions().isEmpty());
        assertTrue(rig.savedDeployments().isEmpty());
    }

    @Test
    void should_not_touch_meta_for_an_agent_with_no_phone_number_or_no_waba() {
        Agent draft = agent();
        draft.setPhoneNumberId(null);
        Rig one = rig(List.of(), List.of(), deployedAgainst(LIVE_ID), true);
        one.service().ensureConnectorsBackfilled(draft);
        assertTrue(one.meta().paths.isEmpty());

        Agent noWaba = agent();
        noWaba.setWabaId(null);
        Rig two = rig(List.of(), List.of(), deployedAgainst(LIVE_ID), true);
        two.service().ensureConnectorsBackfilled(noWaba);
        assertTrue(two.meta().paths.isEmpty());
    }
}
