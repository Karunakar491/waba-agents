package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.connector.dto.ConnectorLibraryDtos;
import com.metaagent.platform.domain.connector.entity.Connector;
import com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
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

    @BeforeEach
    void setUp() {
        authenticateAs(1L);
        connectorRepository = mock(ConnectorRepository.class);
        connectorActionRepository = mock(ConnectorActionRepository.class);
        service = new ConnectorLibraryService(
                connectorRepository,
                connectorActionRepository,
                mock(ConnectorDeploymentRepository.class),
                mock(AgentRepository.class),
                mock(AgentService.class),
                mock(AgentDeployService.class),
                mock(WabaAccessGuard.class),
                new ObjectMapper());
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
