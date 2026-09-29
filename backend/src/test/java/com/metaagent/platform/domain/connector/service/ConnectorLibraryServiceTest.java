package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.connector.dto.ConnectorLibraryDtos;
import com.metaagent.platform.domain.connector.entity.Connector;
import com.metaagent.platform.domain.connector.entity.ConnectorDeployment;
import com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import com.metaagent.platform.infrastructure.crypto.SecretEncryptor;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.connector.entity.ConnectorAction;
import com.metaagent.platform.domain.connector.repository.ConnectorActionRepository;
import java.util.Optional;
import org.mockito.ArgumentCaptor;
import com.metaagent.platform.common.security.TenantDetails;
import org.junit.jupiter.api.AfterEach;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

/**
 * Verifies the outbound Meta payload shape — specifically the auth_config
 * nesting bug (2026-08-13): this service used a flat {"headers": [...]} shape
 * while Meta actually requires it nested under the type-named key
 * ({"api_key": {"headers": [...]}}), already confirmed live via a real Meta
 * 400 on the legacy per-agent connector path (AgentDetailPage.tsx). Every
 * Connector Library deploy failed until this was fixed to match.
 */
class ConnectorLibraryServiceTest {

    private ConnectorLibraryService service;
    private ConnectorRepository connectorRepository;
    private ConnectorActionRepository connectorActionRepository;
    private ConnectorDeploymentRepository deploymentRepository;
    private AgentRepository agentRepository;
    private AgentService agentService;
    private AgentDeployService agentDeployService;
    private SecretEncryptor secretEncryptor;

    @BeforeEach
    void setUp() {
        authenticateAs(1L);
        connectorRepository = mock(ConnectorRepository.class);
        connectorActionRepository = mock(ConnectorActionRepository.class);
        deploymentRepository = mock(ConnectorDeploymentRepository.class);
        agentRepository = mock(AgentRepository.class);
        agentService = mock(AgentService.class);
        agentDeployService = mock(AgentDeployService.class);
        // A real encryptor, not a mock — round-tripping is the whole point of
        // what's under test here. Any valid 32-byte AES-256 key will do.
        secretEncryptor = new SecretEncryptor(
                java.util.Base64.getEncoder().encodeToString(new byte[32]));
        service = new ConnectorLibraryService(
                connectorRepository,
                connectorActionRepository,
                deploymentRepository,
                agentRepository,
                agentService,
                agentDeployService,
                mock(WabaAccessGuard.class),
                new ObjectMapper(),
                secretEncryptor);
    }

    @Test
    void should_nest_api_key_auth_config_under_type_named_key() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        ConnectorLibraryDtos.AuthShape shape = new ConnectorLibraryDtos.AuthShape(
                List.of(new ConnectorLibraryDtos.HeaderField("X-Shopify-Storefront-Access-Token", null)),
                null, null, null);
        Connector connector = Connector.builder()
                .name("shopifycartconnector")
                .description("Shopify storefront cart connector")
                .baseUrl("https://dyheez-ji.myshopify.com/api/2026-04")
                .authType("API_KEY")
                .requiresCertificate(false)
                .authConfigShape(objectMapper.writeValueAsString(shape))
                .build();

        Map<String, Object> payload = service.metaPayload(
                connector, Map.of("X-Shopify-Storefront-Access-Token", "shpat_test_token"));

        @SuppressWarnings("unchecked")
        Map<String, Object> authConfig = (Map<String, Object>) payload.get("auth_config");
        assertNotNull(authConfig, "auth_config must be present for an API_KEY connector");
        assertTrue(authConfig.containsKey("api_key"), "auth_config must nest headers under 'api_key', not flat");

        @SuppressWarnings("unchecked")
        Map<String, Object> apiKey = (Map<String, Object>) authConfig.get("api_key");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> headers = (List<Map<String, Object>>) apiKey.get("headers");
        assertEquals(1, headers.size());
        assertEquals("X-Shopify-Storefront-Access-Token", headers.get(0).get("field_name"));
        assertEquals("shpat_test_token", headers.get(0).get("value"));
    }

    @Test
    void should_nest_oauth2_auth_config_under_type_named_key() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper();
        ConnectorLibraryDtos.AuthShape shape = new ConnectorLibraryDtos.AuthShape(
                null, "https://auth.example.com/token", List.of("read"), "client-abc");
        Connector connector = Connector.builder()
                .name("oauth connector")
                .description("desc")
                .baseUrl("https://api.example.com")
                .authType("OAUTH2_CLIENT_CREDENTIALS")
                .requiresCertificate(false)
                .authConfigShape(objectMapper.writeValueAsString(shape))
                .build();

        Map<String, Object> payload = service.metaPayload(connector, Map.of("client_secret", "shh"));

        @SuppressWarnings("unchecked")
        Map<String, Object> authConfig = (Map<String, Object>) payload.get("auth_config");
        assertTrue(authConfig.containsKey("oauth2_client_credentials"));
    }

    @Test
    void should_send_empty_auth_config_object_for_none_auth_type() {
        // Confirmed live 2026-08-13: Meta rejects agent_connectors creation with a
        // generic 400 if auth_config is omitted entirely, even for NONE. Real
        // IndiaMART Google Sheets connectors (auth_type NONE) failed until an empty
        // auth_config object was added.
        Connector connector = Connector.builder()
                .name("sheets connector")
                .description("desc")
                .baseUrl("https://script.google.com/macros/s/abc")
                .authType("NONE")
                .requiresCertificate(false)
                .build();

        Map<String, Object> payload = service.metaPayload(connector, Map.of());

        assertTrue(payload.containsKey("auth_config"), "auth_config must be present even for NONE auth type");
        @SuppressWarnings("unchecked")
        Map<String, Object> authConfig = (Map<String, Object>) payload.get("auth_config");
        assertTrue(authConfig.isEmpty());
    }

    @Test
    void should_sanitize_display_name_into_a_plain_identifier_for_meta() {
        // Confirmed live 2026-08-13: "IndiaMART Pricing API (Demo via Sheets + Apps
        // Script)" got the identical generic 400 that a space-free, paren-free name
        // of the exact same connector (same base_url, same auth_config) did not.
        // description is unaffected — only name needs sanitizing.
        Connector connector = Connector.builder()
                .name("IndiaMART Pricing API (Demo via Sheets + Apps Script)")
                .description("Real HTTP JSON API backed by a Google Sheet via Apps Script Web App.")
                .baseUrl("https://script.google.com/macros/s/abc")
                .authType("NONE")
                .requiresCertificate(false)
                .build();

        Map<String, Object> payload = service.metaPayload(connector, Map.of());

        assertEquals("indiamart_pricing_api_demo_via_sheets_apps_script", payload.get("name"));
        assertEquals("Real HTTP JSON API backed by a Google Sheet via Apps Script Web App.",
                payload.get("description"), "description must stay free text, unlike name");
    }

    // --- Actions -----------------------------------------------------------

    /**
     * The guard is the whole risk here. An action id alone must never be enough:
     * two accounts' connectors live in one table, and findByIdAndConnectorId is
     * what stops account A reading account B's action by guessing an id.
     */
    @Test
    void should_refuse_to_read_an_action_belonging_to_another_connector() {
        Connector owned = Connector.builder().accountId(1L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        // The action exists, but not under connector 100.
        when(connectorActionRepository.findByIdAndConnectorId(555L, 100L)).thenReturn(Optional.empty());

        assertThrows(NotFoundException.class, () -> service.deleteAction(100L, 555L));
        verify(connectorActionRepository, never()).delete(any());
    }

    @Test
    void should_refuse_a_second_action_with_the_same_name() {
        Connector owned = Connector.builder().accountId(1L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        when(connectorActionRepository.existsByConnectorIdAndName(100L, "product_search")).thenReturn(true);

        ConnectorLibraryDtos.ActionRequest request = new ConnectorLibraryDtos.ActionRequest(
                "  product_search  ", "Search products", objectNode("{\"method\":\"POST\",\"path\":\"/\"}"), false);

        BusinessException thrown = assertThrows(BusinessException.class, () -> service.createAction(100L, request));
        // Names the collision instead of letting Meta reject it at deploy time.
        assertTrue(thrown.getMessage().contains("product_search"));
        verify(connectorActionRepository, never()).save(any());
    }

    @Test
    void should_store_the_request_definition_verbatim_including_nested_string_nodes() {
        Connector owned = Connector.builder().accountId(7L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        when(connectorActionRepository.existsByConnectorIdAndName(anyLong(), anyString())).thenReturn(false);
        when(connectorActionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // A nested body: Meta requires each nested node as a JSON-encoded STRING.
        // Our storage must not "helpfully" reshape that.
        String definition = "{\"method\":\"POST\",\"path\":\"/\",\"body\":{\"content_type\":\"application/json\","
                + "\"params\":{\"home\":{\"type\":\"object\",\"properties\":{\"delhi\":\"{\\\"type\\\":\\\"string\\\"}\"}}}}}";

        ConnectorLibraryDtos.ActionResponse response = service.createAction(100L,
                new ConnectorLibraryDtos.ActionRequest("nested", "Nested body", objectNode(definition), false));

        ArgumentCaptor<ConnectorAction> saved = ArgumentCaptor.forClass(ConnectorAction.class);
        verify(connectorActionRepository).save(saved.capture());
        assertEquals(7L, saved.getValue().getAccountId(), "account must come from the connector, never the request");
        assertEquals("nested", saved.getValue().getName());
        // The escaped inner node survives storage untouched.
        assertTrue(saved.getValue().getRequestDefinition().contains("\\\"type\\\":\\\"string\\\""));
        // And comes back out as real JSON, not a quoted string.
        assertTrue(response.requestDefinition().isObject());
        assertEquals("POST", response.requestDefinition().path("method").asText());
    }

    @Test
    void should_reject_a_request_definition_that_is_not_an_object() {
        Connector owned = Connector.builder().accountId(1L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        when(connectorActionRepository.existsByConnectorIdAndName(anyLong(), anyString())).thenReturn(false);

        for (String bad : new String[] {"[1,2]", "\"just a string\"", "null"}) {
            assertThrows(BusinessException.class, () -> service.createAction(100L,
                    new ConnectorLibraryDtos.ActionRequest("a", "b", objectNode(bad), false)),
                    "should reject " + bad);
        }
        verify(connectorActionRepository, never()).save(any());
    }

    /**
     * The connector data-loss the spec flags: transformation_spec (or
     * anything else one editor doesn't model) used to vanish the moment a
     * different, simpler editor saved the same action, because the whole
     * request_definition document was overwritten wholesale.
     */
    @Test
    void should_keep_a_field_the_update_did_not_send() {
        Connector owned = Connector.builder().accountId(1L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        ConnectorAction existing = ConnectorAction.builder()
                .id(555L).accountId(1L).connectorId(100L)
                .name("book_slot").description("Book a slot")
                .requestDefinition("{\"method\":\"POST\",\"path\":\"/\","
                        + "\"transformation_spec\":{\"output\":\"summary\"}}")
                .userAuthRequired(false)
                .build();
        when(connectorActionRepository.findByIdAndConnectorId(555L, 100L)).thenReturn(Optional.of(existing));
        when(connectorActionRepository.existsByConnectorIdAndName(anyLong(), anyString())).thenReturn(false);
        when(connectorActionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // The wizard's simpler editor: same method/path, no idea transformation_spec exists.
        ConnectorLibraryDtos.ActionRequest request = new ConnectorLibraryDtos.ActionRequest(
                "book_slot", "Book a slot", objectNode("{\"method\":\"PUT\",\"path\":\"/\"}"), false);

        ConnectorLibraryDtos.ActionResponse response = service.updateAction(100L, 555L, request);

        assertEquals("PUT", response.requestDefinition().path("method").asText(), "the sent field must still win");
        assertEquals("summary", response.requestDefinition().path("transformation_spec").path("output").asText(),
                "a field this editor never sent must survive, not be wiped");
    }

    @Test
    void should_let_an_update_explicitly_clear_a_field_by_sending_null() {
        Connector owned = Connector.builder().accountId(1L).wabaId(9L).build();
        when(connectorRepository.findById(100L)).thenReturn(Optional.of(owned));
        ConnectorAction existing = ConnectorAction.builder()
                .id(555L).accountId(1L).connectorId(100L)
                .name("book_slot").description("Book a slot")
                .requestDefinition("{\"method\":\"POST\",\"path\":\"/\",\"transformation_spec\":{\"output\":\"summary\"}}")
                .userAuthRequired(false)
                .build();
        when(connectorActionRepository.findByIdAndConnectorId(555L, 100L)).thenReturn(Optional.of(existing));
        when(connectorActionRepository.existsByConnectorIdAndName(anyLong(), anyString())).thenReturn(false);
        when(connectorActionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ConnectorLibraryDtos.ActionRequest request = new ConnectorLibraryDtos.ActionRequest(
                "book_slot", "Book a slot",
                objectNode("{\"method\":\"POST\",\"path\":\"/\",\"transformation_spec\":null}"), false);

        ConnectorLibraryDtos.ActionResponse response = service.updateAction(100L, 555L, request);

        assertTrue(response.requestDefinition().path("transformation_spec").isNull(),
                "an editor that knows the field can still explicitly clear it");
    }

    // ---------------------------------------------------------------------
    // Tool sync — deploying a connector must instantiate its actions as Meta
    // tools. It never did, so every connector we deployed arrived on Meta with
    // zero tools and the agent had nothing it could call. Confirmed in
    // production 2026-09-18 on a live WhatsApp number that had made zero API
    // calls in its life and was inventing prices to cover the gap.
    // ---------------------------------------------------------------------

    private static final String DEF = "{\"method\":\"POST\",\"path\":\"/v1/general\"}";

    /** Wires up the happy path for deploy(), leaving the tool behaviour to each test. */
    private Connector givenDeployableConnector() {
        Connector connector = Connector.builder()
                .id(10L)
                .wabaId(7L)
                .name("astrotalk kundli api")
                .description("d")
                .baseUrl("https://api.kundali.astrotalk.com")
                .authType("NONE")
                .requiresCertificate(false)
                .build();
        connector.setUpdatedAt(java.time.LocalDateTime.now().minusDays(1));
        when(connectorRepository.findById(10L)).thenReturn(Optional.of(connector));

        com.metaagent.platform.domain.agent.entity.Agent agent =
                com.metaagent.platform.domain.agent.entity.Agent.builder()
                        .id(20L).wabaId(7L).phoneNumberId("555").displayName("Astrotalk").build();
        when(agentService.getAgent(20L)).thenReturn(agent);
        when(deploymentRepository.findByConnectorIdAndAgentId(10L, 20L)).thenReturn(Optional.empty());
        when(deploymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(agentDeployService.createConnector(eq(20L), any())).thenReturn(Map.of("id", "meta-conn-1"));
        return connector;
    }

    private static ConnectorAction action(String name, String description, String definition) {
        return ConnectorAction.builder()
                .id(1L).accountId(1L).connectorId(10L)
                .name(name).description(description)
                .requestDefinition(definition).userAuthRequired(false)
                .build();
    }

    private ConnectorLibraryDtos.DeploymentView deploy() {
        return service.deploy(10L, new ConnectorLibraryDtos.DeployRequest("20", Map.of()));
    }

    @Test
    void should_create_every_action_as_a_tool_when_meta_holds_none() {
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of());

        ConnectorLibraryDtos.DeploymentView view = deploy();

        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);
        verify(agentDeployService).createTool(eq(20L), eq("meta-conn-1"), payload.capture());
        assertEquals("general_kundli", payload.getValue().get("name"));
        assertEquals("Fetch the Kundli", payload.getValue().get("description"));
        assertEquals(false, payload.getValue().get("user_auth_required"));
        assertEquals(objectNode(DEF), payload.getValue().get("request_definition"),
                "the stored definition is Meta's own JSON and must go out verbatim, not as a quoted string");
        assertEquals("LIVE", view.status());
    }

    @Test
    void should_not_rewrite_a_tool_meta_already_holds_unchanged() {
        // The whole point of matching by name. Without it every redeploy would
        // either duplicate the tools or rewrite all of them every time.
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(Map.of(
                "id", "tool-1",
                "name", "general_kundli",
                "description", "Fetch the Kundli",
                "user_auth_required", false,
                // Meta returns its own key order — a string comparison would call
                // this changed and rewrite it on every single deploy.
                "request_definition", Map.of("path", "/v1/general", "method", "POST"))));

        assertEquals("LIVE", deploy().status());

        verify(agentDeployService, never()).createTool(any(), any(), any());
        verify(agentDeployService, never()).updateTool(any(), any(), any(), any());
    }

    @Test
    void should_update_a_tool_whose_definition_drifted() {
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(Map.of(
                "id", "tool-1",
                "name", "general_kundli",
                "description", "an older description",
                "user_auth_required", false,
                "request_definition", Map.of("method", "POST", "path", "/v1/general"))));

        deploy();

        verify(agentDeployService).updateTool(eq(20L), eq("meta-conn-1"), eq("tool-1"), any());
        verify(agentDeployService, never()).createTool(any(), any(), any());
    }

    @Test
    void should_leave_a_meta_tool_alone_when_the_library_no_longer_has_it() {
        // A customer can be mid-conversation on that tool call. Removing it is a
        // separate deliberate act, never a side effect of deploying.
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(
                Map.of("id", "tool-1", "name", "general_kundli", "description", "Fetch the Kundli",
                        "user_auth_required", false,
                        "request_definition", Map.of("method", "POST", "path", "/v1/general")),
                Map.of("id", "tool-2", "name", "a_retired_action", "description", "gone from the library",
                        "user_auth_required", false, "request_definition", Map.of())));

        deploy();

        verify(agentDeployService, never()).deleteTool(any(), any(), any());
    }

    /**
     * Meta requires nested body nodes as JSON-ENCODED STRINGS, and we store that
     * shape verbatim (see should_store_the_request_definition_verbatim... above
     * and docs/meta-api/connector-tools-capability-matrix.md).
     *
     * What we do NOT know is which encoding Meta uses when it hands the
     * definition back from a GET. Both are tested, because betting on one is how
     * this whole incident started: if a redeploy sees the other encoding and
     * calls it "changed", every nested-body tool is rewritten on every single
     * deploy, forever, while the deploy still reports success.
     */
    private static final String NESTED_DEF =
            "{\"method\":\"POST\",\"path\":\"/\",\"body\":{\"content_type\":\"application/json\","
                    + "\"params\":{\"home\":{\"type\":\"object\",\"properties\":"
                    + "{\"delhi\":\"{\\\"type\\\":\\\"string\\\"}\"}}}}}";

    @Test
    void should_not_rewrite_a_nested_body_tool_meta_echoes_back_in_string_encoding() {
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("nested", "Nested body", NESTED_DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(Map.of(
                "id", "tool-1", "name", "nested", "description", "Nested body",
                "user_auth_required", false,
                "request_definition", Map.of(
                        "method", "POST", "path", "/",
                        "body", Map.of("content_type", "application/json",
                                "params", Map.of("home", Map.of("type", "object",
                                        // same encoding we sent: the leaf is a STRING
                                        "properties", Map.of("delhi", "{\"type\":\"string\"}"))))))));

        deploy();

        verify(agentDeployService, never()).updateTool(any(), any(), any(), any());
    }

    @Test
    void should_not_rewrite_a_nested_body_tool_meta_echoes_back_already_parsed() {
        // The dangerous one: Meta validates these definitions, so it may well
        // return the leaf parsed into a real object rather than the string we
        // sent. Same content, different depth of encoding — must not count as a
        // change, or every nested tool is rewritten on every deploy for ever.
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("nested", "Nested body", NESTED_DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(Map.of(
                "id", "tool-1", "name", "nested", "description", "Nested body",
                "user_auth_required", false,
                "request_definition", Map.of(
                        "method", "POST", "path", "/",
                        "body", Map.of("content_type", "application/json",
                                "params", Map.of("home", Map.of("type", "object",
                                        // parsed, not a string
                                        "properties", Map.of("delhi", Map.of("type", "string")))))))));

        deploy();

        verify(agentDeployService, never()).updateTool(any(), any(), any(), any());
    }

    @Test
    void should_still_detect_a_real_change_inside_a_nested_body() {
        // The normalisation must not be so forgiving that genuine drift stops
        // being noticed — that would be the opposite failure, a tool left wrong.
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("nested", "Nested body", NESTED_DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of(Map.of(
                "id", "tool-1", "name", "nested", "description", "Nested body",
                "user_auth_required", false,
                "request_definition", Map.of(
                        "method", "POST", "path", "/",
                        "body", Map.of("content_type", "application/json",
                                "params", Map.of("home", Map.of("type", "object",
                                        "properties", Map.of("delhi", "{\"type\":\"number\"}"))))))));

        deploy();

        verify(agentDeployService).updateTool(eq(20L), eq("meta-conn-1"), eq("tool-1"), any());
    }

    @Test
    void should_report_partial_not_failed_when_the_existing_tools_cannot_be_listed() {
        /*
         * The connector was created on Meta seconds earlier. If only the
         * read-back of its tools fails, reporting "Meta rejected this connector"
         * is false, and it files the reason under lastError where the PARTIAL
         * status never looks — the same conflation the separate column exists to
         * prevent.
         */
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1"))
                .thenThrow(new RuntimeException("upstream timeout"));

        ConnectorLibraryDtos.DeploymentView view = deploy();

        assertEquals("PARTIAL", view.status());
        assertNotNull(view.deployedAt(), "the connector itself did reach Meta");
        assertTrue(view.lastError().contains("could not be checked"));
        // Nothing may be created blind: we do not know what is already there.
        verify(agentDeployService, never()).createTool(any(), any(), any());
    }

    @Test
    void should_report_partial_when_one_action_fails_but_still_sync_the_others() {
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L)).thenReturn(List.of(
                action("check_payment_status", "a", DEF),
                action("create_payment_link", "b", DEF),
                action("find_payment_link", "c", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of());
        when(agentDeployService.createTool(eq(20L), eq("meta-conn-1"), argThat(
                (Map<String, Object> p) -> "create_payment_link".equals(p.get("name")))))
                .thenThrow(new RuntimeException("Meta said no"));

        ConnectorLibraryDtos.DeploymentView view = deploy();

        // The other two still landed — one bad definition must not cost the rest.
        verify(agentDeployService, times(3)).createTool(eq(20L), eq("meta-conn-1"), any());
        assertEquals("PARTIAL", view.status());
        assertTrue(view.lastError().contains("create_payment_link"),
                "the operator must be told WHICH action failed, not just that something did");
        assertTrue(view.lastError().contains("1 of 3"));
        assertNotNull(view.deployedAt(), "the connector itself genuinely reached Meta");
    }

    @Test
    void should_report_partial_for_an_action_whose_stored_definition_is_not_valid_json() {
        // A broken template must cost only itself. The risk here is the opposite:
        // requireDefinitionJson throws a BusinessException, and it is easy to
        // assume that escapes and fails the whole deploy. It must be caught by
        // the per-action try like any other failure.
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L)).thenReturn(List.of(
                action("bad_json", "broken template", "{not valid"),
                action("general_kundli", "Fetch the Kundli", DEF)));
        when(agentDeployService.listTools(20L, "meta-conn-1")).thenReturn(List.of());

        ConnectorLibraryDtos.DeploymentView view = deploy();

        assertEquals("PARTIAL", view.status());
        assertTrue(view.lastError().contains("bad_json"));
        // The healthy one still landed, and Meta was never called for the broken one.
        verify(agentDeployService, times(1)).createTool(eq(20L), eq("meta-conn-1"), any());
    }

    @Test
    void should_clear_partial_once_the_failing_action_is_deleted_and_redeployed() {
        // The natural way out of PARTIAL: the operator removes the broken action
        // and deploys again. If the note did not clear, the connector would read
        // "Missing actions" for ever with nothing left to fix.
        givenDeployableConnector();
        ConnectorDeployment existing = ConnectorDeployment.builder()
                .connectorId(10L).agentId(20L)
                .metaConnectorId("meta-conn-1")
                .deployedAt(java.time.LocalDateTime.now().minusHours(2))
                .toolSyncError("Connector deployed, but 1 of 1 actions could not be set up: bad_json")
                .build();
        when(deploymentRepository.findByConnectorIdAndAgentId(10L, 20L)).thenReturn(Optional.of(existing));
        when(agentDeployService.updateConnector(eq(20L), eq("meta-conn-1"), any()))
                .thenReturn(Map.of("id", "meta-conn-1"));
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L)).thenReturn(List.of());

        ConnectorLibraryDtos.DeploymentView view = deploy();

        assertEquals("LIVE", view.status(), "with the broken action gone there is nothing left to report");
        assertNull(view.lastError());
        assertNull(existing.getToolSyncError());
    }

    @Test
    void should_clear_a_stale_partial_note_when_the_connector_call_itself_fails() {
        /*
         * The bug this guards, caught at the EM gate before it shipped.
         *
         * deploy() loads an EXISTING deployment row. A row already marked PARTIAL
         * carries a toolSyncError. If a later redeploy throws at the CONNECTOR
         * level, the catch sets lastError but leaves deployedAt alone — so
         * without clearing toolSyncError the row still reports PARTIAL, and the
         * operator reads "missing actions" while the real, worse failure sits in
         * lastError where the status function never looks.
         */
        Connector connector = givenDeployableConnector();
        ConnectorDeployment existing = ConnectorDeployment.builder()
                .connectorId(10L).agentId(20L)
                .metaConnectorId("meta-conn-1")
                .deployedAt(java.time.LocalDateTime.now().minusHours(2))
                .toolSyncError("Connector deployed, but 1 of 3 actions could not be set up: create_payment_link")
                .build();
        when(deploymentRepository.findByConnectorIdAndAgentId(10L, 20L)).thenReturn(Optional.of(existing));
        when(agentDeployService.updateConnector(eq(20L), eq("meta-conn-1"), any()))
                .thenThrow(new RuntimeException("Meta rejected the base URL"));

        assertThrows(BusinessException.class, this::deploy);

        assertNull(existing.getToolSyncError(),
                "a stale partial-tools note must not survive to mask a fresh connector-level failure");
        assertNotNull(existing.getLastError());
        assertNotNull(connector);
    }

    @Test
    void should_not_touch_meta_tools_at_all_when_the_kill_switch_is_off() {
        // This is the kill switch. If it does not actually stop the calls it is
        // not a kill switch, and the Kill Switch mandate is not satisfied.
        org.springframework.test.util.ReflectionTestUtils.setField(service, "toolSyncEnabled", false);
        givenDeployableConnector();
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(10L))
                .thenReturn(List.of(action("general_kundli", "Fetch the Kundli", DEF)));

        assertEquals("LIVE", deploy().status());

        verify(agentDeployService, never()).listTools(any(), any());
        verify(agentDeployService, never()).createTool(any(), any(), any());
    }

    // ---------------------------------------------------------------------
    // Stored credentials (V64) — founder's call, 2026-09-28: a deploy with no
    // secrets reuses what the last deploy to that agent stored, so a
    // republish never asks for the key again.
    // ---------------------------------------------------------------------

    private Connector givenApiKeyConnector() {
        ConnectorLibraryDtos.AuthShape shape = new ConnectorLibraryDtos.AuthShape(
                List.of(new ConnectorLibraryDtos.HeaderField("X-API-Key", null)), null, null, null);
        Connector connector = Connector.builder()
                .id(11L).wabaId(7L)
                .name("astrotalk pricing api")
                .description("d")
                .baseUrl("https://api.astrotalk.com")
                .authType("API_KEY")
                .authConfigShape(writeShape(shape))
                .requiresCertificate(false)
                .build();
        connector.setUpdatedAt(java.time.LocalDateTime.now().minusDays(1));
        when(connectorRepository.findById(11L)).thenReturn(Optional.of(connector));

        com.metaagent.platform.domain.agent.entity.Agent agent =
                com.metaagent.platform.domain.agent.entity.Agent.builder()
                        .id(21L).wabaId(7L).phoneNumberId("555").displayName("Astrotalk").build();
        when(agentService.getAgent(21L)).thenReturn(agent);
        when(agentRepository.findById(21L)).thenReturn(Optional.of(agent));
        when(agentDeployService.createConnector(eq(21L), any())).thenReturn(Map.of("id", "meta-conn-2"));
        when(agentDeployService.updateConnector(eq(21L), eq("meta-conn-2"), any())).thenReturn(Map.of("id", "meta-conn-2"));
        when(connectorActionRepository.findAllByConnectorIdOrderByNameAsc(11L)).thenReturn(List.of());
        return connector;
    }

    private static String writeShape(ConnectorLibraryDtos.AuthShape shape) {
        try {
            return new ObjectMapper().writeValueAsString(shape);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Test
    void should_store_supplied_secrets_encrypted_on_the_deployment_row() {
        givenApiKeyConnector();
        when(deploymentRepository.findByConnectorIdAndAgentId(11L, 21L)).thenReturn(Optional.empty());
        ArgumentCaptor<ConnectorDeployment> saved = ArgumentCaptor.forClass(ConnectorDeployment.class);
        when(deploymentRepository.save(saved.capture())).thenAnswer(inv -> inv.getArgument(0));

        service.deploy(11L, new ConnectorLibraryDtos.DeployRequest("21", Map.of("X-API-Key", "secret-value")));

        String stored = saved.getValue().getEncryptedSecrets();
        assertNotNull(stored);
        assertFalse(stored.contains("secret-value"), "must be ciphertext, not the plaintext key");
        assertTrue(secretEncryptor.decrypt(stored).contains("secret-value"),
                "the stored ciphertext must actually decrypt back to the value sent");
    }

    @Test
    void should_reuse_stored_secrets_when_a_redeploy_supplies_none() {
        givenApiKeyConnector();
        String encrypted = secretEncryptor.encrypt("{\"X-API-Key\":\"stored-value\"}");
        ConnectorDeployment existing = ConnectorDeployment.builder()
                .connectorId(11L).agentId(21L).metaConnectorId("meta-conn-2")
                .encryptedSecrets(encrypted)
                .deployedAt(java.time.LocalDateTime.now().minusDays(2))
                .build();
        when(deploymentRepository.findByConnectorIdAndAgentId(11L, 21L)).thenReturn(Optional.of(existing));
        when(deploymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        ArgumentCaptor<Map<String, Object>> payload = ArgumentCaptor.forClass(Map.class);

        service.deploy(11L, new ConnectorLibraryDtos.DeployRequest("21", Map.of()));

        verify(agentDeployService).updateConnector(eq(21L), eq("meta-conn-2"), payload.capture());
        @SuppressWarnings("unchecked")
        Map<String, Object> authConfig = (Map<String, Object>) payload.getValue().get("auth_config");
        @SuppressWarnings("unchecked")
        Map<String, Object> apiKey = (Map<String, Object>) authConfig.get("api_key");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> headers = (List<Map<String, Object>>) apiKey.get("headers");
        assertEquals("stored-value", headers.get(0).get("value"),
                "a redeploy with no secrets supplied must fall back to what was stored");
    }

    @Test
    void should_refuse_a_first_deploy_with_no_secrets_and_none_stored() {
        givenApiKeyConnector();
        when(deploymentRepository.findByConnectorIdAndAgentId(11L, 21L)).thenReturn(Optional.empty());

        assertThrows(BusinessException.class,
                () -> service.deploy(11L, new ConnectorLibraryDtos.DeployRequest("21", Map.of())),
                "no secrets supplied and none stored yet must still refuse, not silently deploy with no auth");
    }

    @Test
    void should_publish_to_every_agent_named_and_report_each_outcome_separately() {
        givenApiKeyConnector();
        String encrypted = secretEncryptor.encrypt("{\"X-API-Key\":\"stored-value\"}");
        ConnectorDeployment onAgent21 = ConnectorDeployment.builder()
                .connectorId(11L).agentId(21L).metaConnectorId("meta-conn-2").encryptedSecrets(encrypted)
                .deployedAt(java.time.LocalDateTime.now().minusDays(2)).build();
        when(deploymentRepository.findByConnectorIdAndAgentId(11L, 21L)).thenReturn(Optional.of(onAgent21));
        when(deploymentRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // A second agent whose stored credentials were never captured — its
        // redeploy must fail without taking the first agent down with it.
        com.metaagent.platform.domain.agent.entity.Agent agent22 =
                com.metaagent.platform.domain.agent.entity.Agent.builder()
                        .id(22L).wabaId(7L).phoneNumberId("556").displayName("Astrotalk Backup").build();
        when(agentService.getAgent(22L)).thenReturn(agent22);
        when(agentRepository.findById(22L)).thenReturn(Optional.of(agent22));
        ConnectorDeployment onAgent22 = ConnectorDeployment.builder()
                .connectorId(11L).agentId(22L).metaConnectorId("meta-conn-3").build(); // no stored secrets
        when(deploymentRepository.findByConnectorIdAndAgentId(11L, 22L)).thenReturn(Optional.of(onAgent22));

        List<ConnectorLibraryDtos.PublishResult> results =
                service.publishToAgents(11L, List.of("21", "22"));

        assertEquals(2, results.size());
        ConnectorLibraryDtos.PublishResult first = results.get(0);
        assertEquals("21", first.agentId());
        assertEquals("Astrotalk", first.agentName());
        assertTrue(first.success());

        ConnectorLibraryDtos.PublishResult second = results.get(1);
        assertEquals("22", second.agentId());
        assertEquals("Astrotalk Backup", second.agentName());
        assertFalse(second.success(), "no stored secrets for this agent must fail it, not the whole batch");
        assertNotNull(second.message());
    }

    private static com.fasterxml.jackson.databind.JsonNode objectNode(String json) {
        try {
            return new ObjectMapper().readTree(json);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    /**
     * SecurityContextHelper reads the tenant from auth.getDetails(), not the
     * principal — copied from AgentDeployServiceTest so both behave the same.
     */
    private void authenticateAs(Long targetAccountId) {
        TenantDetails tenantDetails = new TenantDetails(targetAccountId, 1L, "ROLE_USER");
        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                "user@test.com", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        authentication.setDetails(tenantDetails);
        SecurityContext ctx = SecurityContextHolder.createEmptyContext();
        ctx.setAuthentication(authentication);
        SecurityContextHolder.setContext(ctx);
    }

    @AfterEach
    void clearAuth() {
        SecurityContextHolder.clearContext();
    }
}
