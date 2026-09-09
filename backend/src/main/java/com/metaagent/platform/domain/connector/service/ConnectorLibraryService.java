package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.exception.NotFoundException;
import com.metaagent.platform.domain.connector.entity.ConnectorAction;
import com.metaagent.platform.domain.connector.repository.ConnectorActionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.transaction.annotation.Transactional;
import com.metaagent.platform.common.security.SecurityContextHelper;
import com.metaagent.platform.domain.agent.dto.ConnectorDtos;
import com.metaagent.platform.domain.agent.entity.Agent;
import com.metaagent.platform.domain.agent.repository.AgentRepository;
import com.metaagent.platform.domain.agent.service.AgentDeployService;
import com.metaagent.platform.domain.agent.service.AgentService;
import com.metaagent.platform.domain.connector.dto.ConnectorLibraryDtos;
import com.metaagent.platform.domain.connector.entity.Connector;
import com.metaagent.platform.domain.connector.entity.ConnectorDeployment;
import com.metaagent.platform.domain.connector.repository.ConnectorDeploymentRepository;
import com.metaagent.platform.domain.connector.repository.ConnectorRepository;
import com.metaagent.platform.domain.waba.service.WabaAccessGuard;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Reusable Connector Library (V46) — the definition layer above Meta.
 *
 * Deliberately the same shape as {@code SkillLibraryService}: a WABA-scoped
 * library row that lives in our DB whether or not Meta has ever heard of it,
 * plus an explicit per-agent deploy action that is the ONLY path which talks
 * to Meta. Editing a library connector never pushes anything.
 *
 * Three layers, do not confuse them:
 *   connector             — this. Our definition. Reusable.
 *   connector_deployment  — this. One definition on one agent, with the Meta id.
 *   agent_connector (V45) — a read-cache of Meta's live state. Untouched here.
 *
 * SECRETS: nothing in this class ever writes a credential to the database.
 * DeployRequest.secrets is read, folded into the outbound Meta payload, and
 * discarded with the request.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConnectorLibraryService {

    private static final String AUTH_API_KEY = "API_KEY";
    private static final String AUTH_OAUTH2 = "OAUTH2_CLIENT_CREDENTIALS";
    private static final String AUTH_NONE = "NONE";

    private final ConnectorRepository connectorRepository;
    private final ConnectorActionRepository connectorActionRepository;
    private final ConnectorDeploymentRepository deploymentRepository;
    private final AgentRepository agentRepository;
    private final AgentService agentService;
    private final AgentDeployService agentDeployService;
    private final WabaAccessGuard wabaAccessGuard;
    private final ObjectMapper objectMapper;

    // ---------------------------------------------------------------------
    // Library CRUD — DB only, never touches Meta.
    // ---------------------------------------------------------------------

    public ConnectorLibraryDtos.ConnectorResponse create(ConnectorLibraryDtos.CreateRequest request) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(request.wabaId());
        requireWabaAccess(wabaId, accountId);
        requireKnownAuthType(request.authType());

        Connector connector = Connector.builder()
                .accountId(accountId)
                .wabaId(wabaId)
                .name(request.name())
                .description(request.description())
                .systemType(request.systemType())
                .baseUrl(request.baseUrl())
                .authType(request.authType())
                .authConfigShape(writeShape(request.authShape()))
                .requiresCertificate(request.requiresCertificate())
                .tags(request.tags())
                .status(Connector.STATUS_DRAFT)
                .build();
        return toResponse(connectorRepository.save(connector), List.of());
    }

    public List<ConnectorLibraryDtos.ConnectorResponse> list(String wabaIdRaw) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Long wabaId = parseId(wabaIdRaw);
        requireWabaAccess(wabaId, accountId);

        List<Connector> connectors = connectorRepository.findAllByWabaId(wabaId);
        Map<Long, List<ConnectorLibraryDtos.DeploymentView>> byConnector = deploymentViews(connectors, wabaId);
        return connectors.stream()
                .map(c -> toResponse(c, byConnector.getOrDefault(c.getId(), List.of())))
                .toList();
    }

    public ConnectorLibraryDtos.ConnectorResponse update(Long connectorId, ConnectorLibraryDtos.UpdateRequest request) {
        Connector connector = loadOwned(connectorId);
        requireKnownAuthType(request.authType());

        connector.setName(request.name());
        connector.setDescription(request.description());
        connector.setSystemType(request.systemType());
        connector.setBaseUrl(request.baseUrl());
        connector.setAuthType(request.authType());
        connector.setAuthConfigShape(writeShape(request.authShape()));
        connector.setRequiresCertificate(request.requiresCertificate());
        connector.setTags(request.tags());
        connector = connectorRepository.save(connector);
        // Every existing deployment is now older than updatedAt, i.e. Out of
        // sync, until it is redeployed. Nothing is pushed from here.
        return toResponse(connector, deploymentViews(List.of(connector), connector.getWabaId())
                .getOrDefault(connector.getId(), List.of()));
    }

    /** Publishing is ours, not Meta's — it only means "ready for others to deploy". */
    public ConnectorLibraryDtos.ConnectorResponse publish(Long connectorId) {
        Connector connector = loadOwned(connectorId);
        connector.setStatus(Connector.STATUS_PUBLISHED);
        connector = connectorRepository.save(connector);
        return toResponse(connector, deploymentViews(List.of(connector), connector.getWabaId())
                .getOrDefault(connector.getId(), List.of()));
    }

    public void delete(Long connectorId) {
        Connector connector = loadOwned(connectorId);
        if (!deploymentRepository.findAllByConnectorId(connectorId).isEmpty()) {
            throw new BusinessException(
                    "This connector is deployed to at least one agent. Remove it from those agents first.");
        }
        connectorRepository.delete(connector);
    }

    // ---------------------------------------------------------------------
    // Deploy — the ONLY path that reaches Meta.
    //
    // Not @Transactional on purpose: the Meta call is not rollback-able, and a
    // failure must still leave a persisted deployment row carrying last_error
    // so the operator can see what happened. Same reasoning as
    // SkillLibraryService.syncSkills.
    // ---------------------------------------------------------------------

    public ConnectorLibraryDtos.DeploymentView deploy(Long connectorId, ConnectorLibraryDtos.DeployRequest request) {
        Connector connector = loadOwned(connectorId);
        Long agentId = parseId(request.agentId());
        Agent agent = agentService.getAgent(agentId); // access-checked
        if (agent.getPhoneNumberId() == null) {
            throw new BusinessException("Connect a phone number to this agent before deploying a connector to it.");
        }
        if (connector.getWabaId() != null && !connector.getWabaId().equals(agent.getWabaId())) {
            throw new BusinessException("That agent is on a different WABA than this connector's library.");
        }

        Map<String, String> secrets = request.secrets() == null ? Map.of() : request.secrets();
        Map<String, Object> payload = metaPayload(connector, secrets);

        ConnectorDeployment deployment = deploymentRepository
                .findByConnectorIdAndAgentId(connectorId, agentId)
                .orElseGet(() -> ConnectorDeployment.builder().connectorId(connectorId).agentId(agentId).build());
        deployment.setPhoneNumberId(agent.getPhoneNumberId());

        try {
            Map<String, Object> response = deployment.getMetaConnectorId() == null
                    ? agentDeployService.createConnector(agentId, payload)
                    : agentDeployService.updateConnector(agentId, deployment.getMetaConnectorId(), payload);

            String metaId = response != null && response.get("id") != null
                    ? response.get("id").toString()
                    : deployment.getMetaConnectorId();
            deployment.setMetaConnectorId(metaId);

            if (connector.isRequiresCertificate() && metaId != null) {
                uploadCertificateIfSupplied(agentId, metaId, secrets);
            }

            deployment.setDeployedAt(LocalDateTime.now());
            deployment.setLastError(null);
        } catch (Exception e) {
            log.warn("Connector deploy failed: connectorId={} agentId={} error={}", connectorId, agentId, e.getMessage());
            deployment.setLastError(truncate(e.getMessage(), 1024));
            deploymentRepository.save(deployment);
            throw new BusinessException("Meta rejected this connector: " + e.getMessage());
        }
        deployment = deploymentRepository.save(deployment);
        return toDeploymentView(deployment, agent, connector);
    }

    /**
     * mTLS material is optional at deploy time. If it isn't supplied the
     * connector is still created — Meta will simply report it as not connected
     * until the certificate is uploaded from the agent's Connectors tab. We do
     * not fail the deploy over it, and we never store the PEM.
     */
    private void uploadCertificateIfSupplied(Long agentId, String metaConnectorId, Map<String, String> secrets) {
        String cert = secrets.get("client_certificate");
        String key = secrets.get("client_key");
        if (isBlank(cert) || isBlank(key)) return;

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("client_certificate", cert);
        body.put("client_key", key);
        if (!isBlank(secrets.get("ca_certificate"))) body.put("ca_certificate", secrets.get("ca_certificate"));
        agentDeployService.upsertConnectorCertificate(agentId, metaConnectorId, body);
    }

    /**
     * Builds Meta's BizAIOmniChannelConnectorRequest from our definition + this deploy's secrets.
     * Package-private (not private) so ConnectorLibraryServiceTest can verify the payload shape
     * directly, without standing up a full deploy() call and its agent/Meta dependencies.
     */
    Map<String, Object> metaPayload(Connector connector, Map<String, String> secrets) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("name", toMetaConnectorName(connector.getName()));
        payload.put("description", connector.getDescription());
        payload.put("base_url", connector.getBaseUrl());
        payload.put("auth_type", connector.getAuthType());
        payload.put("requires_certificate", connector.isRequiresCertificate());

        ConnectorLibraryDtos.AuthShape shape = readShape(connector.getAuthConfigShape());
        if (AUTH_API_KEY.equals(connector.getAuthType()) && shape != null && shape.headers() != null) {
            List<Map<String, Object>> headers = new ArrayList<>();
            for (ConnectorLibraryDtos.HeaderField field : shape.headers()) {
                String value = secrets.get(field.fieldName());
                if (isBlank(value)) {
                    throw new BusinessException("Enter a value for the '" + field.fieldName() + "' header before deploying.");
                }
                Map<String, Object> header = new LinkedHashMap<>();
                header.put("field_name", field.fieldName());
                header.put("value", value);
                if (!isBlank(field.prefix())) header.put("prefix", field.prefix());
                headers.add(header);
            }
            // Nested under the type-named key — confirmed live against real Meta
            // (AgentDetailPage.tsx's legacy per-agent connector path hit a real
            // 400 "auth_config.api_key is required for API_KEY auth type" on the
            // old flat shape, fixed there, confirmed working). This service was
            // never updated to match — it kept the flat shape and that's the
            // actual cause of every Connector Library deploy failing with a
            // generic 400 (see wiki/bugs-violations/connector-creation-never-succeeds-2026-08-13.md).
            if (!headers.isEmpty()) payload.put("auth_config", Map.of("api_key", Map.of("headers", headers)));
        } else if (AUTH_OAUTH2.equals(connector.getAuthType())) {
            if (shape == null || isBlank(shape.tokenUrl()) || isBlank(shape.clientId())) {
                throw new BusinessException("This connector is missing its OAuth token URL or client id.");
            }
            String clientSecret = secrets.get("client_secret");
            if (isBlank(clientSecret)) {
                throw new BusinessException("Enter the OAuth client secret before deploying.");
            }
            // Same type-named-wrapper pattern as API_KEY above, applied by symmetry —
            // matches AgentDetailPage.tsx's oauth2_client_credentials key.
            Map<String, Object> oauth = new LinkedHashMap<>();
            oauth.put("token_url", shape.tokenUrl());
            oauth.put("scopes_to_request", shape.scopes() == null ? List.of() : shape.scopes());
            oauth.put("client_id", shape.clientId());
            oauth.put("client_secret", clientSecret);
            payload.put("auth_config", Map.of("oauth2_client_credentials", oauth));
        } else if (AUTH_NONE.equals(connector.getAuthType())) {
            // Meta rejects agent_connectors creation with a generic 400 ("The request
            // is not valid for this connector") if auth_config is omitted entirely,
            // even for NONE — confirmed live 2026-08-13 against the IndiaMART Google
            // Sheets connectors. An empty object satisfies it.
            payload.put("auth_config", Map.of());
        }
        return payload;
    }

    // ---------------------------------------------------------------------
    // Aggregate view — library rows plus the live mirror rollup, with the
    // heuristic "used by N" replaced by the real deployment count wherever a
    // mirror row is actually one of our deployments.
    // ---------------------------------------------------------------------

    public ConnectorDtos.ConnectorListResponse listLiveForWaba(Long wabaId, Long accountId) {
        ConnectorDtos.ConnectorListResponse live = agentDeployService.listConnectorsForWaba(wabaId, accountId);

        List<Connector> connectors = connectorRepository.findAllByWabaId(wabaId);
        if (connectors.isEmpty()) return live;

        Map<Long, Integer> countByConnector = new HashMap<>();
        Map<String, Long> connectorIdByMetaId = new HashMap<>();
        for (ConnectorDeployment d : deploymentRepository.findAllByConnectorIdIn(
                connectors.stream().map(Connector::getId).toList())) {
            if (d.getDeployedAt() == null) continue;
            countByConnector.merge(d.getConnectorId(), 1, Integer::sum);
            if (d.getMetaConnectorId() != null) connectorIdByMetaId.put(d.getMetaConnectorId(), d.getConnectorId());
        }

        List<ConnectorDtos.ConnectorRow> rows = live.connectors().stream().map(row -> {
            Long libraryId = connectorIdByMetaId.get(row.id());
            if (libraryId == null) return row;
            return new ConnectorDtos.ConnectorRow(
                    row.id(), row.name(), row.agentId(), row.agentName(), row.phoneNumberId(),
                    row.status(), row.authType(), row.baseUrl(), row.systemType(), row.tags(),
                    row.publishedToLibrary(),
                    countByConnector.getOrDefault(libraryId, 1), // real COUNT(*), not the name+base_url guess
                    row.cached(), row.lastSyncedAt(),
                    String.valueOf(libraryId));
        }).toList();
        return new ConnectorDtos.ConnectorListResponse(rows, live.cached());
    }

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    private Map<Long, List<ConnectorLibraryDtos.DeploymentView>> deploymentViews(List<Connector> connectors, Long wabaId) {
        if (connectors.isEmpty() || wabaId == null) return Map.of();
        Map<Long, Agent> agentsById = new HashMap<>();
        for (Agent agent : agentRepository.findAllByWabaId(wabaId)) agentsById.put(agent.getId(), agent);

        Map<Long, Connector> connectorsById = new HashMap<>();
        for (Connector c : connectors) connectorsById.put(c.getId(), c);

        Map<Long, List<ConnectorLibraryDtos.DeploymentView>> out = new HashMap<>();
        for (ConnectorDeployment d : deploymentRepository.findAllByConnectorIdIn(connectorsById.keySet())) {
            out.computeIfAbsent(d.getConnectorId(), k -> new ArrayList<>())
                    .add(toDeploymentView(d, agentsById.get(d.getAgentId()), connectorsById.get(d.getConnectorId())));
        }
        return out;
    }

    private static ConnectorLibraryDtos.DeploymentView toDeploymentView(
            ConnectorDeployment deployment, Agent agent, Connector connector) {
        String status;
        if (deployment.getDeployedAt() == null) {
            status = deployment.getLastError() != null ? "FAILED" : "PENDING";
        } else if (connector != null && deployment.getDeployedAt().isBefore(connector.getUpdatedAt())) {
            status = "OUT_OF_SYNC";
        } else {
            status = "LIVE";
        }
        return new ConnectorLibraryDtos.DeploymentView(
                String.valueOf(deployment.getAgentId()),
                agent != null ? agent.getDisplayName() : null,
                deployment.getPhoneNumberId(),
                deployment.getMetaConnectorId(),
                deployment.getDeployedAt() == null ? null : deployment.getDeployedAt().toString(),
                status,
                deployment.getLastError());
    }

    private ConnectorLibraryDtos.ConnectorResponse toResponse(
            Connector connector, List<ConnectorLibraryDtos.DeploymentView> deployments) {
        List<String> tags = connector.getTags() == null || connector.getTags().isBlank()
                ? List.of()
                : java.util.Arrays.stream(connector.getTags().split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
        int usedBy = (int) deployments.stream().filter(d -> d.deployedAt() != null).count();
        return new ConnectorLibraryDtos.ConnectorResponse(
                String.valueOf(connector.getId()),
                connector.getWabaId() == null ? null : String.valueOf(connector.getWabaId()),
                connector.getName(),
                connector.getDescription(),
                connector.getSystemType(),
                connector.getBaseUrl(),
                connector.getAuthType(),
                readShape(connector.getAuthConfigShape()),
                connector.isRequiresCertificate(),
                tags,
                connector.getStatus(),
                connector.getUpdatedAt().toString(),
                usedBy,
                deployments);
    }

    /**
     * Package-private rather than private: {@link ConnectorProbeService} needs
     * exactly this check and must not grow its own. A probe that scoped access
     * differently from every other endpoint here would be the one way to reach
     * another tenant's connector.
     */
    Connector loadOwned(Long connectorId) {
        Long accountId = SecurityContextHelper.getRequiredAccountId();
        Connector connector = connectorRepository.findById(connectorId)
                .orElseThrow(() -> new NotFoundException("Connector not found"));
        requireWabaAccess(connector.getWabaId(), accountId);
        return connector;
    }

    private void requireWabaAccess(Long wabaId, Long accountId) {
        if (wabaId == null) {
            throw new BusinessException("You don't have access to this WABA's Connector Library.");
        }
        wabaAccessGuard.requireAccess(wabaId, accountId);
    }

    private static void requireKnownAuthType(String authType) {
        if (!AUTH_API_KEY.equals(authType) && !AUTH_OAUTH2.equals(authType) && !AUTH_NONE.equals(authType)) {
            throw new BusinessException("Auth type must be one of API_KEY, OAUTH2_CLIENT_CREDENTIALS, NONE.");
        }
    }

    private String writeShape(ConnectorLibraryDtos.AuthShape shape) {
        if (shape == null) return null;
        try {
            return objectMapper.writeValueAsString(shape);
        } catch (Exception e) {
            throw new BusinessException("Could not save this connector's auth settings.");
        }
    }

    private ConnectorLibraryDtos.AuthShape readShape(String json) {
        if (json == null || json.isBlank()) return null;
        try {
            return objectMapper.readValue(json, ConnectorLibraryDtos.AuthShape.class);
        } catch (Exception e) {
            log.warn("Unreadable auth_config_shape, treating as empty: {}", e.getMessage());
            return null;
        }
    }

    /**
     * Meta's agent_connectors {@code name} must be a plain identifier (no spaces,
     * no parentheses) — confirmed live 2026-08-13: "IndiaMART Pricing API (Demo via
     * Sheets + Apps Script)" got the identical generic 400 that a space-free,
     * paren-free name of the same connector did not. It is NOT the same field as
     * {@code description}, which is free text and unaffected. Our library's
     * {@code name} is a human display label (shown in the UI, can have spaces);
     * this derives a safe technical identifier from it without changing what's
     * stored in our own DB.
     */
    private static String toMetaConnectorName(String displayName) {
        String slug = displayName.trim().toLowerCase()
                .replaceAll("[^a-z0-9]+", "_")
                .replaceAll("^_+|_+$", "");
        return slug.isEmpty() ? "connector" : slug;
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static String truncate(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private static Long parseId(String raw) {
        try {
            return Long.parseLong(raw);
        } catch (Exception e) {
            throw new BusinessException("Invalid id: " + raw);
        }
    }

    // ---------------------------------------------------------------------
    // Actions — what a connector can DO. DB only; deploying is what reaches Meta.
    //
    // These live on the library connector because Meta scopes tools to a phone
    // number, so an action for an undeployed connector has nowhere else to be.
    // Editing one deliberately does NOT touch a running agent: that would change
    // a live client's behaviour as a side effect of an edit in a library screen.
    // ---------------------------------------------------------------------

    public List<ConnectorLibraryDtos.ActionResponse> listActions(Long connectorId) {
        loadOwned(connectorId);
        return connectorActionRepository.findAllByConnectorIdOrderByNameAsc(connectorId).stream()
                .map(ConnectorLibraryService::toActionResponse)
                .toList();
    }

    @Transactional
    public ConnectorLibraryDtos.ActionResponse createAction(Long connectorId, ConnectorLibraryDtos.ActionRequest request) {
        Connector connector = loadOwned(connectorId);
        String name = request.name().trim();
        // Meta refuses two tools with the same name on one connector. Saying so
        // here beats letting the operator find out at deploy time.
        if (connectorActionRepository.existsByConnectorIdAndName(connectorId, name)) {
            throw new BusinessException("This connector already has an action called \"" + name + "\".");
        }
        ConnectorAction action = ConnectorAction.builder()
                .accountId(connector.getAccountId())
                .connectorId(connectorId)
                .name(name)
                .description(request.description().trim())
                .requestDefinition(writeJson(request.requestDefinition()))
                .userAuthRequired(request.userAuthRequired())
                .build();
        return toActionResponse(connectorActionRepository.save(action));
    }

    @Transactional
    public ConnectorLibraryDtos.ActionResponse updateAction(
            Long connectorId, Long actionId, ConnectorLibraryDtos.ActionRequest request) {
        loadOwned(connectorId);
        ConnectorAction action = connectorActionRepository.findByIdAndConnectorId(actionId, connectorId)
                .orElseThrow(() -> new NotFoundException("Action not found"));
        String name = request.name().trim();
        if (!name.equals(action.getName())
                && connectorActionRepository.existsByConnectorIdAndName(connectorId, name)) {
            throw new BusinessException("This connector already has an action called \"" + name + "\".");
        }
        action.setName(name);
        action.setDescription(request.description().trim());
        action.setRequestDefinition(writeJson(request.requestDefinition()));
        action.setUserAuthRequired(request.userAuthRequired());
        return toActionResponse(connectorActionRepository.save(action));
    }

    @Transactional
    public void deleteAction(Long connectorId, Long actionId) {
        loadOwned(connectorId);
        ConnectorAction action = connectorActionRepository.findByIdAndConnectorId(actionId, connectorId)
                .orElseThrow(() -> new NotFoundException("Action not found"));
        // Template only. Any Meta tool already instantiated from it on a live
        // agent stays exactly where it is — removing it there is a separate,
        // deliberate act against that agent.
        connectorActionRepository.delete(action);
    }

    private static ConnectorLibraryDtos.ActionResponse toActionResponse(ConnectorAction action) {
        return new ConnectorLibraryDtos.ActionResponse(
                String.valueOf(action.getId()),
                String.valueOf(action.getConnectorId()),
                action.getName(),
                action.getDescription(),
                readJson(action.getRequestDefinition()),
                action.isUserAuthRequired(),
                action.getUpdatedAt() == null ? null : action.getUpdatedAt().toString());
    }

    private static final ObjectMapper ACTION_JSON = new ObjectMapper();

    /** Stored verbatim, so a shape Meta accepts is never lost to our own modelling. */
    private static String writeJson(JsonNode node) {
        if (node == null || node.isNull()) {
            throw new BusinessException("This action needs a request definition.");
        }
        if (!node.isObject()) {
            throw new BusinessException("The request definition must be a JSON object.");
        }
        return node.toString();
    }

    private static JsonNode readJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return ACTION_JSON.createObjectNode();
        }
        try {
            return ACTION_JSON.readTree(raw);
        } catch (Exception e) {
            // One unreadable row must not break the whole list.
            return ACTION_JSON.createObjectNode();
        }
    }
}
