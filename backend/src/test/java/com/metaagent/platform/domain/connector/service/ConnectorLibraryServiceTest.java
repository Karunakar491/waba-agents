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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;

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

    @BeforeEach
    void setUp() {
        service = new ConnectorLibraryService(
                mock(ConnectorRepository.class),
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
}
