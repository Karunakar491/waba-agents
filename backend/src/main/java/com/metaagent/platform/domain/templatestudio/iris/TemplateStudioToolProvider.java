package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.templatestudio.EditTemplateRequest;
import com.metaagent.platform.domain.templatestudio.TemplateRequest;
import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import com.metaagent.platform.domain.waba.entity.Waba;
import com.metaagent.platform.domain.waba.service.WabaService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Today's four Iris tools (create_template/edit_template/list_templates/
 * send_test_template), moved verbatim out of IrisConversationService as part
 * of the 2026-08-12 IrisToolProvider extraction (see wiki/decisions/2026-08-
 * 12-iris-generalization-plan.md, step 1) — pure relocation, no logic change.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class TemplateStudioToolProvider implements IrisToolProvider {

    private final TemplateStudioService templateStudioService;
    private final KarixMessagingClient karixMessagingClient;
    private final WabaService wabaService;
    private final Validator validator;

    /**
     * A bare {"type":"array"} schema gave the model zero shape guidance —
     * live-tested (2026-08-06) against a real model with that bare schema,
     * it reliably invented Meta's message-SENDING-time component shapes
     * (flat {"type":"image","image":{"link":...}}, one component per
     * button) instead of the correct template-CREATION-time shapes below.
     * Kept terse by design (EM condition) — component essentials only, not
     * a full API reference.
     */
    private static final String COMPONENTS_SCHEMA_DESCRIPTION =
            "Each entry is one Meta template component (creation-time shape, NOT the message-sending shape). " +
            "BODY {type,text} — required, exactly one. If text contains any {{n}} variable placeholder, you MUST also " +
            "include \"example\":{\"body_text\":[[\"<sample value for {{1}}>\",\"<sample for {{2}}>\",...]]} with one " +
            "sample string per placeholder, in order — Karix rejects a template with placeholders and no example block " +
            "(confirmed live 2026-08-07: \"BODY text has placeholders (1) but no example block\"). " +
            "Also: {{n}} must never be the very first or very last thing in the body text — Meta rejects leading/trailing " +
            "variables (confirmed live 2026-08-07: \"Leading or trailing params not allowed\"); always put real words " +
            "before and after every placeholder. " +
            "HEADER {type,format} — optional. format TEXT needs a \"text\" field. format LOCATION needs nothing else " +
            "(the location itself is supplied when the message is sent, not at creation). format IMAGE/VIDEO/DOCUMENT " +
            "REQUIRES \"example\":{\"header_handle\":[\"<handle>\"]} with a real uploaded-media handle — Meta rejects " +
            "the template at creation without one, so never invent or omit this; if the operator hasn't attached a " +
            "file yet (see the attached-image tag instructions above), ask them to attach one instead of guessing. " +
            "FOOTER {type,text} — optional. " +
            "BUTTONS {type,buttons:[...]} — at most ONE such component wrapping ALL buttons in one nested array, " +
            "never one component per button; each entry in that array is {type,text,...} where type is URL/PHONE_NUMBER/QUICK_REPLY/OTP. " +
            "For category AUTHENTICATION specifically, the BUTTONS component's single button MUST be " +
            "{\"type\":\"OTP\",\"otp_type\":\"COPY_CODE\",\"example\":\"<sample one-time code, e.g. 123456>\"} — " +
            "Meta rejects an AUTHENTICATION template missing otp_type or example on the OTP button (PM-caught gap, 2026-08-07 audit).";

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_template", "Create a new WhatsApp template. Requires user confirmation before it is actually submitted. " +
                    "For category AUTHENTICATION specifically, codeExpirationMinutes (1-90) is required by Meta — omit it for every other category.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string"),
                            "language", Map.of("type", "string"),
                            "category", Map.of("type", "string"),
                            "components", Map.of("type", "array", "description", COMPONENTS_SCHEMA_DESCRIPTION),
                            "codeExpirationMinutes", Map.of("type", "integer")),
                            "required", List.of("wabaId", "templateName", "language", "category", "components")),
                    true),
            new AiToolSpec("edit_template", "Edit an existing WhatsApp template's components. Requires user confirmation. " +
                    "For an AUTHENTICATION template, codeExpirationMinutes (1-90) is required by Meta — omit it for every other category.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateId", Map.of("type", "string"),
                            "components", Map.of("type", "array", "description", COMPONENTS_SCHEMA_DESCRIPTION),
                            "codeExpirationMinutes", Map.of("type", "integer")),
                            "required", List.of("wabaId", "templateId", "components")),
                    true),
            new AiToolSpec("list_templates", "List existing templates for a WABA, optionally filtered by status. Read-only, runs immediately.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "status", Map.of("type", "string")),
                            "required", List.of("wabaId")),
                    false),
            new AiToolSpec("send_test_template", "Send an approved template to a single test phone number. Requires user confirmation. " +
                    "templateName MUST be the template's name field (e.g. from list_templates), NEVER its numeric fb_template_id — " +
                    "Karix's real send API rejects a numeric id with \"HSM ID does not exist\" (confirmed 2026-08-07 live send test). " +
                    "parameterValues fills the template's positional placeholders in order — for an AUTHENTICATION/OTP template " +
                    "this is the one-time code value that goes into {{1}} and the OTP button.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string"),
                            "testPhoneNumber", Map.of("type", "string"),
                            "parameterValues", Map.of("type", "array", "items", Map.of("type", "string"))),
                            "required", List.of("wabaId", "templateName", "testPhoneNumber")),
                    true)
    );

    @Override
    public List<AiToolSpec> tools() {
        return TOOLS;
    }

    @Override
    public String systemPromptFragment(Long accountId) {
        List<Waba> wabas = wabaService.listForAccount(accountId);
        String wabaList = describeWabas(wabas);
        return """
                Every tool call requires a wabaId. Here are the WABAs this operator can use:
                %s
                If there is only one, use it without asking. If there are several, ask which one they mean before \
                doing anything — never guess. Once you know which WABA, say its name back in your reply before \
                proposing any action (e.g. "Using WABA \\"Acme Retail\\" — here's the template I'll create") so the \
                operator always sees which WABA an action applies to.

                Meta requires exact values on every template: category must be exactly MARKETING, UTILITY, or \
                AUTHENTICATION (uppercase, no other categories exist) — never a lowercase guess. language must be a \
                Meta locale code like en_US, never a bare language name like "English".""".formatted(wabaList);
    }

    /**
     * Iris resolves wabaId itself from conversation (no upfront picker) —
     * the model supplies it on every tool call. This is the one place ALL
     * template-tool dispatch passes through, so the account-membership
     * check lives here rather than trusting each downstream service to
     * remember its own (TemplateStudioService/KarixMessagingClient both
     * already check too, but that's defense in depth, not a substitute).
     */
    @Override
    public Map<String, Object> execute(String toolName, Map<String, Object> args, Long accountId) {
        Long wabaId = Long.valueOf(String.valueOf(args.get("wabaId")));
        Set<Long> accountWabaIds = wabaService.listForAccount(accountId).stream().map(Waba::getId).collect(Collectors.toSet());
        if (!accountWabaIds.contains(wabaId)) {
            log.warn("execute rejected: tool={} wabaId={} not in caller's account WABAs {}", toolName, wabaId, accountWabaIds);
            throw new BusinessException("That WABA isn't available on this account.");
        }
        log.info("execute: tool={} wabaId={}", toolName, wabaId);
        return switch (toolName) {
            // EL-caught gap (2026-08-07 audit): this used to build the raw
            // Karix payload by hand from model output, bypassing the exact
            // @Valid TemplateRequest/EditTemplateRequest validation the
            // human UI path enforces — a model-drafted template could reach
            // Karix with no schema check at all beyond system-prompt prose.
            // Now runs through the SAME validated DTO the controller uses.
            case "create_template" -> {
                TemplateRequest request = new TemplateRequest(
                        String.valueOf(args.get("templateName")),
                        String.valueOf(args.get("language")),
                        String.valueOf(args.get("category")),
                        castComponents(args.get("components")),
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))),
                        args.get("parameterFormat") == null ? null : String.valueOf(args.get("parameterFormat")));
                validateOrThrow(request);
                yield templateStudioService.createTemplate(wabaId, request.toKarixPayload());
            }
            case "edit_template" -> {
                EditTemplateRequest request = new EditTemplateRequest(
                        castComponents(args.get("components")),
                        null, null, null,
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))));
                validateOrThrow(request);
                yield templateStudioService.editTemplate(wabaId, String.valueOf(args.get("templateId")), request.toKarixPayload());
            }
            case "list_templates" -> templateStudioService.listTemplates(wabaId, (String) args.get("status"));
            case "send_test_template" -> {
                @SuppressWarnings("unchecked")
                List<String> parameterValues = args.get("parameterValues") == null
                        ? List.of()
                        : ((List<Object>) args.get("parameterValues")).stream().map(String::valueOf).toList();
                yield karixMessagingClient.sendTestTemplate(wabaId, String.valueOf(args.get("templateName")), String.valueOf(args.get("testPhoneNumber")), parameterValues);
            }
            default -> throw new BusinessException("Unknown tool: " + toolName);
        };
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castComponents(Object rawComponents) {
        if (!(rawComponents instanceof List<?> list)) {
            throw new BusinessException("components must be a list.");
        }
        return (List<Map<String, Object>>) list;
    }

    private <T> void validateOrThrow(T request) {
        Set<ConstraintViolation<T>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            String message = violations.stream()
                    .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                    .findFirst()
                    .orElse("Validation failed");
            throw new BusinessException(message);
        }
    }

    private String describeWabas(List<Waba> wabas) {
        if (wabas.isEmpty()) {
            return "(none — this account has no WABAs yet, tell the operator there's nothing to work with)";
        }
        return wabas.stream()
                .map(w -> "- \"%s\" (wabaId: %d)".formatted(w.getLabel(), w.getId()))
                .collect(Collectors.joining("\n"));
    }
}
