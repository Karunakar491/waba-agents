package com.metaagent.platform.domain.templatestudio.iris;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.domain.iris.AiToolSpec;
import com.metaagent.platform.domain.iris.IrisToolProvider;
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

import java.util.ArrayList;
import java.util.LinkedHashMap;
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
    private final ObjectMapper objectMapper;
    private final IrisAttachmentRegistry attachmentRegistry;
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
            "Conversely, if the body text has NO {{n}} placeholder at all, the BODY object must be ONLY {\"type\":\"BODY\"," +
            "\"text\":\"...\"} — no \"example\" key whatsoever, not even an empty \"example\":{} — Meta rejects a plain, " +
            "variable-free body that carries ANY example key, empty or not (confirmed live 2026-08-19: \"components\" " +
            "param is missing expected field(s), error_subcode 2388043 — first with a populated example.body_text on a " +
            "placeholder-free body, then again with an empty example:{} on the SAME placeholder-free body). The example " +
            "array's length must exactly match the number of {{n}} placeholders — zero placeholders means the key is " +
            "fully absent from the JSON, never present with any value including {} or []. " +
            "The \"example\" key goes INSIDE the same single BODY object as \"text\" — never as a second separate BODY " +
            "component, and never as a sibling of \"components\" at the top level of the tool call. There is EXACTLY " +
            "ONE BODY object in the whole components array, and it carries both text and example together, e.g.: " +
            "{\"type\":\"BODY\",\"text\":\"Order {{1}} confirmed, arrives by {{2}}\",\"example\":{\"body_text\":[[\"12345\",\"2026-08-20\"]]}} " +
            "(confirmed live 2026-08-19: a second BODY object or a top-level example both fail template creation). " +
            "Also: {{n}} must never be the very first or very last thing in the body text — Meta rejects leading/trailing " +
            "variables (confirmed live 2026-08-07: \"Leading or trailing params not allowed\"); always put real words " +
            "before and after every placeholder. " +
            "HEADER {type,format} — optional. format TEXT needs a \"text\" field. format LOCATION needs nothing else " +
            "(the location itself is supplied when the message is sent, not at creation). format IMAGE/VIDEO/DOCUMENT " +
            "REQUIRES \"example\":{\"header_handle\":[\"<filename>\"]} — put the attached file's FILENAME here, NEVER " +
            "the long file_handle value itself (see the attached-file tag instructions above for why); the system " +
            "resolves the filename to the real handle server-side. Never invent or omit this — if the operator " +
            "hasn't attached a file yet, ask them to attach one instead of guessing. " +
            "FOOTER {type,text} — optional. " +
            "BUTTONS {type,buttons:[...]} — at most ONE such component wrapping ALL buttons in one nested array, " +
            "never one component per button; each entry in that array is {type,text,...} where type is URL/PHONE_NUMBER/QUICK_REPLY/OTP. " +
            "For category AUTHENTICATION specifically, the BUTTONS component's single button MUST be " +
            "{\"type\":\"OTP\",\"otp_type\":\"COPY_CODE\",\"example\":\"<sample one-time code, e.g. 123456>\"} — " +
            "Meta rejects an AUTHENTICATION template missing otp_type or example on the OTP button (PM-caught gap, 2026-08-07 audit). " +
            "CAROUSEL {type,cards:[...]} — optional, for a template that shows a swipeable set of cards alongside the " +
            "normal top-level BODY (the top-level components list still needs its own BODY entry separately; CAROUSEL " +
            "is an additional component, not a replacement for BODY). Each entry in \"cards\" is {components:[...]} — " +
            "each card's own components list follows the SAME rules as above: a HEADER (format IMAGE/VIDEO, same " +
            "REQUIRED \"example\":{\"header_handle\":[...]} rule), an optional card-level BODY, and at most one " +
            "BUTTONS component (URL and/or QUICK_REPLY only — no PHONE_NUMBER or OTP buttons inside a card). Every " +
            "card needs the same component shapes as every other card in the same carousel.";

    private static final List<AiToolSpec> TOOLS = List.of(
            new AiToolSpec("create_template", "Create a new WhatsApp template. Requires user confirmation before it is actually submitted. " +
                    "For category AUTHENTICATION specifically, codeExpirationMinutes (1-90) is required by Meta — omit it for every other category.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateName", Map.of("type", "string", "description",
                                    "lowercase letters, numbers, and underscores ONLY — snake_case, no spaces, no capital " +
                                    "letters. Convert whatever name the operator says into this format yourself before " +
                                    "calling the tool (e.g. \"Ramadan Sale\" becomes \"ramadan_sale\") — never pass a " +
                                    "human-readable name through as-is. Meta rejects any other format (confirmed live " +
                                    "2026-08-19: \"Name format is incorrect\" / \"template_name should typically be " +
                                    "lowercase letters, numbers, and underscores only\")."),
                            "language", Map.of("type", "string"),
                            "category", Map.of("type", "string"),
                            "components", Map.of("type", "array", "description", COMPONENTS_SCHEMA_DESCRIPTION),
                            "codeExpirationMinutes", Map.of("type", "integer")),
                            "required", List.of("wabaId", "templateName", "language", "category", "components")),
                    true),
            new AiToolSpec("edit_template", "Edit an existing WhatsApp template's components. Requires user confirmation. " +
                    "This REPLACES the entire components array — it is not a partial patch. You MUST call get_template " +
                    "first to see the template's current components, then pass back that full set with only the " +
                    "requested change applied (e.g. adding one footer keeps the existing header/body/buttons exactly " +
                    "as they were) — never reconstruct components from memory or invent what the template currently " +
                    "has (live-caught 2026-08-19: doing so silently dropped an existing HEADER when only a FOOTER " +
                    "was asked for). " +
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
            new AiToolSpec("get_template", "Fetch one template's full current components. Read-only, runs immediately. " +
                    "Call this ONCE before editing a template for the first time in this conversation — you cannot " +
                    "know what it already has (header, footer, buttons) without it, and edit_template replaces the " +
                    "WHOLE components array, not just what you name. Its result is shown to you as \"Current template " +
                    "state: {...}\" earlier in this conversation — if you already see that for this exact templateId, " +
                    "do NOT call get_template again; go straight to edit_template using that already-fetched state.",
                    Map.of("type", "object", "properties", Map.of(
                            "wabaId", Map.of("type", "string"),
                            "templateId", Map.of("type", "string")),
                            "required", List.of("wabaId", "templateId")),
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
                In this context you are a marketing/content assistant helping an internal operator draft, edit, \
                and test WhatsApp templates for their brand. You are NOT the brand's deployed customer-facing \
                WhatsApp bot, and you never adopt one — do not greet the operator as if they were an end customer \
                (e.g. never say something like "Welcome to <Brand>!"), do not run a deployed agent's conversation \
                flow, and do not speak in a customer-facing brand voice. If the operator asks what a template will \
                look like, show its exact configured content only — never continue on as if you were chatting with \
                a customer.

                Every tool call requires a wabaId. Here are the WABAs this operator can use:
                %s
                If there is only one, use it without asking. If there are several, ask which one they mean before \
                doing anything — never guess. Once you know which WABA, say its name back in your reply before \
                proposing any action (e.g. "Using WABA \\"Acme Retail\\" — here's the template I'll create") so the \
                operator always sees which WABA an action applies to.

                Meta requires exact values on every template: category must be exactly MARKETING, UTILITY, or \
                AUTHENTICATION (uppercase, no other categories exist) — never a lowercase guess. language must be a \
                Meta locale code like en_US, never a bare language name like "English".

                Never call create_template, edit_template, or send_test_template unless the user has clearly asked \
                for that specific action in this turn — a greeting, a vague message, or small talk gets a plain \
                reply or a clarifying question, never a drafted action. Never invent a templateName, testPhoneNumber, \
                or parameterValue the user didn't actually provide — ask for the missing value instead of guessing \
                one, even a plausible-looking one.

                If the operator's message contains a line like "[Attached template sheet: <fileName> — <N> rows: \
                <rows as JSON>]", they've uploaded a spreadsheet of bare sample content — usually just a few loose \
                columns like a product/offer name, price, or short description, with NO header/footer/button/category \
                information at all. That is expected and is exactly why they're using you: for EACH row, recommend \
                and draft a full, well-formed template yourself — pick whichever structure actually fits that row's \
                content best (a plain TEXT body, a template with an IMAGE/VIDEO/DOCUMENT header, a CAROUSEL, or any \
                other shape the components schema above supports), choose an appropriate category (MARKETING is the \
                default for promotional content unless the row is clearly a transactional/utility message), and give \
                it a clean snake_case templateName derived from the row's content. \
                Go through the rows ONE AT A TIME, not all at once: present your recommendation for a row, then call \
                create_template for it — the existing confirmation step still applies per template, so the operator \
                sees and approves each one before it's created — then move to the next row. Never batch multiple \
                rows into a single tool call, and never skip a row silently; if the total row count reported exceeds \
                what's listed in the tag (truncated sheet), tell the operator only the first ones are shown before \
                you proceed. If a row is missing an image/video/document you'd need for the header you chose, ask \
                the operator to attach that media (see the attached-image tag instructions above) rather than \
                inventing a header_handle.""".formatted(wabaList);
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
        // Defense-in-depth (2026-08-19, live-caught): a confused model can produce
        // a non-numeric wabaId (e.g. the literal string "null") instead of asking
        // which WABA the operator means. This used to crash with an uncaught
        // NumberFormatException -> raw 500; now it's a clean, recoverable error.
        Long wabaId;
        try {
            wabaId = Long.valueOf(String.valueOf(args.get("wabaId")));
        } catch (NumberFormatException e) {
            log.warn("execute rejected: tool={} wabaId arg was not a valid id: {}", toolName, args.get("wabaId"));
            throw new BusinessException("I need to know which WABA this is for — please say which one you mean.");
        }
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
                        resolveAttachmentReferences(accountId, mergeStrayTopLevelComponents(args, castComponents(args.get("components")))),
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))),
                        args.get("parameterFormat") == null ? null : String.valueOf(args.get("parameterFormat")));
                validateOrThrow(request);
                yield templateStudioService.createTemplate(wabaId, request.toKarixPayload());
            }
            case "edit_template" -> {
                String templateId = String.valueOf(args.get("templateId"));
                List<Map<String, Object>> submitted = resolveAttachmentReferences(accountId,
                        mergeStrayTopLevelComponents(args, castComponents(args.get("components"))));
                EditTemplateRequest request = new EditTemplateRequest(
                        preventSilentButtonContactChanges(wabaId, templateId, submitted),
                        null, null, null,
                        args.get("codeExpirationMinutes") == null ? null : Integer.valueOf(String.valueOf(args.get("codeExpirationMinutes"))));
                validateOrThrow(request);
                yield templateStudioService.editTemplate(wabaId, templateId, request.toKarixPayload());
            }
            case "list_templates" -> templateStudioService.listTemplates(wabaId, (String) args.get("status"));
            case "get_template" -> templateStudioService.getTemplate(wabaId, String.valueOf(args.get("templateId")));
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

    /**
     * 2026-08-19 fix: list_templates used to show its raw JSON result
     * verbatim in chat — unreadable. Shape read here ({result: {response:
     * {templates: [...]}}}) is NOT a fresh guess — it's the same structure
     * TemplateStudioClient.countTemplates() already depends on in shipped,
     * running code, per that method's own comment: "Real shape confirmed
     * live 2026-08-12". This method has not been independently re-verified
     * against a live Karix response by this change; if that shape has since
     * drifted, both this and countTemplates() would need updating together.
     * Falls back to a generic line for any other/unrecognized shape rather
     * than guessing at fields that might not exist — never silently drops
     * the fact that something didn't parse as expected.
     */
    @Override
    public String summarizeResult(String toolName, Map<String, Object> result) {
        if ("get_template".equals(toolName)) {
            return summarizeGetTemplate(result);
        }
        if (!"list_templates".equals(toolName)) {
            return IrisToolProvider.super.summarizeResult(toolName, result);
        }
        List<?> templates = extractTemplatesList(result);
        if (templates == null) {
            return "Here are the templates.";
        }
        if (templates.isEmpty()) {
            return "No templates found for that filter.";
        }
        return "Found " + templates.size() + " template" + (templates.size() == 1 ? "" : "s") + ".";
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): the default summarizeResult()
     * returns a generic "Done." for any tool without its own override, and that
     * summary string is the ONLY thing persisted into conversation history for an
     * inline (no-confirmation) tool -- the raw tool result itself is never stored.
     * With the default, get_template's whole current-components result vanished
     * the instant the turn ended: the model had no memory of what it had just
     * fetched, so every follow-up message re-called get_template instead of
     * drafting the edit, live-caught looping 3 turns in a row. This serializes
     * the actual components (plus template_name/category/language, needed to
     * draft a correct edit_template call) as JSON so the model can read them
     * back on its next turn instead of re-fetching or inventing them.
     */
    @SuppressWarnings("unchecked")
    private String summarizeGetTemplate(Map<String, Object> result) {
        if (!(result != null && result.get("result") instanceof Map<?, ?> r
                && r.get("response") instanceof Map<?, ?> rawResponse)) {
            return "Here is the template.";
        }
        Map<String, Object> response = (Map<String, Object>) rawResponse;
        try {
            Map<String, Object> essentials = Map.of(
                    "template_name", String.valueOf(response.getOrDefault("template_name", "")),
                    "category", String.valueOf(response.getOrDefault("category", "")),
                    "language", String.valueOf(response.getOrDefault("language", "")),
                    "components", response.getOrDefault("components", List.of()));
            return "Current template state: " + objectMapper.writeValueAsString(essentials);
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            return "Here is the template.";
        }
    }

    private List<?> extractTemplatesList(Map<String, Object> result) {
        if (result != null && result.get("result") instanceof Map<?, ?> r
                && r.get("response") instanceof Map<?, ?> response
                && response.get("templates") instanceof List<?> list) {
            return list;
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castComponents(Object rawComponents) {
        if (!(rawComponents instanceof List<?> list)) {
            throw new BusinessException("components must be a list.");
        }
        return stripExampleFromPlaceholderFreeBody(flattenNestedButtonsArrays(normalizeMediaHeaderComponents((List<Map<String, Object>>) list)));
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): edit_template replaces the whole
     * components array, and even with get_template + prompt instructions telling
     * Iris to reuse existing content verbatim, it still fabricated a DIFFERENT
     * phone number on a real APPROVED template when asked only to add a footer
     * -- caught and cancelled before confirming, but that was luck, not a
     * guarantee. Unlike the shape bugs above, this can't be fixed by teaching a
     * better schema: the JSON was perfectly well-formed, just factually wrong.
     * This always re-fetches the template's TRUE current state itself (never
     * trusting anything the model claims about what "already exists"), and for
     * any BUTTONS button whose type already existed, restores the ORIGINAL
     * phone_number/url if the model's submission silently differs -- fails
     * closed on business-critical contact info specifically. A model adding a
     * brand-new button type is unaffected; only silent edits to a business's
     * real phone number or link are blocked.
     */
    List<Map<String, Object>> preventSilentButtonContactChanges(Long wabaId, String templateId, List<Map<String, Object>> submittedComponents) {
        Map<String, Map<String, Object>> originalButtonsByType;
        try {
            originalButtonsByType = extractButtonsByType(templateStudioService.getTemplate(wabaId, templateId));
        } catch (RuntimeException e) {
            log.warn("preventSilentButtonContactChanges: could not fetch original template state, skipping protection: {}", e.getMessage());
            return submittedComponents;
        }
        if (originalButtonsByType.isEmpty()) {
            return submittedComponents;
        }
        return submittedComponents.stream().map(component -> protectButtonsComponent(component, originalButtonsByType)).toList();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> protectButtonsComponent(Map<String, Object> component, Map<String, Map<String, Object>> originalButtonsByType) {
        if (!"BUTTONS".equals(component.get("type")) || !(component.get("buttons") instanceof List<?> buttons)) {
            return component;
        }
        List<Object> protectedButtons = buttons.stream().map(buttonObj -> {
            if (!(buttonObj instanceof Map<?, ?> button)) {
                return buttonObj;
            }
            Map<String, Object> original = originalButtonsByType.get(String.valueOf(button.get("type")));
            if (original == null) {
                return buttonObj;
            }
            Map<String, Object> merged = new LinkedHashMap<>((Map<String, Object>) button);
            for (String field : List.of("phone_number", "url")) {
                Object originalValue = original.get(field);
                Object submittedValue = button.get(field);
                if (originalValue != null && submittedValue != null && !originalValue.equals(submittedValue)) {
                    log.warn("preventSilentButtonContactChanges: blocked a silent {} change on an existing {} button (restored the real value)",
                            field, button.get("type"));
                    merged.put(field, originalValue);
                }
            }
            return merged;
        }).toList();
        Map<String, Object> result = new LinkedHashMap<>(component);
        result.put("buttons", protectedButtons);
        return result;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Map<String, Object>> extractButtonsByType(Map<String, Object> getTemplateResult) {
        Map<String, Map<String, Object>> byType = new LinkedHashMap<>();
        if (!(getTemplateResult != null && getTemplateResult.get("result") instanceof Map<?, ?> r
                && r.get("response") instanceof Map<?, ?> response
                && response.get("components") instanceof List<?> components)) {
            return byType;
        }
        for (Object c : components) {
            if (c instanceof Map<?, ?> component && "BUTTONS".equals(component.get("type"))
                    && component.get("buttons") instanceof List<?> buttons) {
                for (Object b : buttons) {
                    if (b instanceof Map<?, ?> button && button.get("type") != null) {
                        byType.put(String.valueOf(button.get("type")), (Map<String, Object>) button);
                    }
                }
            }
        }
        return byType;
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): the prompt only ever taught the
     * model an "[Attached image: ...]" tag convention -- there was no equivalent
     * for "[Attached document: ...]" or "[Attached video: ...]", so when an
     * operator attached a document, the model guessed at a shape instead of
     * following a known pattern: it emitted a top-level {"type":"DOCUMENT",
     * "header_handle":[...]} component instead of the correct {"type":"HEADER",
     * "format":"DOCUMENT","example":{"header_handle":[...]}}. Meta rejected it
     * loud ("(#100) Unexpected key \"header_handle\" on param \"components[1]\"")
     * -- no data was lost, but it's still a real gap. Heals a component whose
     * "type" is IMAGE/VIDEO/DOCUMENT (the media format, mistakenly used as the
     * component type) into a proper HEADER component with the handle correctly
     * nested under example.header_handle, wherever the handle value came from.
     */
    private static final java.util.Set<String> MEDIA_HEADER_FORMATS = java.util.Set.of("IMAGE", "VIDEO", "DOCUMENT");

    List<Map<String, Object>> normalizeMediaHeaderComponents(List<Map<String, Object>> components) {
        return components.stream().map(component -> {
            Object type = component.get("type");
            if (!(type instanceof String typeStr) || !MEDIA_HEADER_FORMATS.contains(typeStr)) {
                return component;
            }
            Object handle = component.containsKey("header_handle") ? component.get("header_handle")
                    : component.get("example") instanceof Map<?, ?> ex ? ex.get("header_handle") : null;
            Map<String, Object> healed = new LinkedHashMap<>();
            healed.put("type", "HEADER");
            healed.put("format", typeStr);
            if (handle != null) {
                healed.put("example", Map.of("header_handle", handle));
            }
            log.info("normalizeMediaHeaderComponents: healed a top-level '{}' component into a proper HEADER component", typeStr);
            return healed;
        }).toList();
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): asking Iris to retype a real
     * ~150-character Meta media handle verbatim in its tool call is unreliable at
     * any model tier -- gpt-5.4-mini corrupted a single character mid-handle (a
     * Z/r transposition) while building a CAROUSEL card, and Meta rejected the
     * whole template as "Uploaded media handle is invalid". No prompt wording
     * fixes this: an LLM byte-for-byte copying a long random token is inherently
     * unreliable. Instead, the model is taught to put the short, human-readable
     * filename (already visible in the "[Attached image: ...]" tag) directly
     * into example.header_handle, and this resolves it back to the real handle
     * server-side via IrisAttachmentRegistry before the payload ever reaches
     * Karix -- the model never sees or retypes the actual handle. Recurses into
     * CAROUSEL cards, since each card carries its own HEADER component.
     */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> resolveAttachmentReferences(Long accountId, List<Map<String, Object>> components) {
        return components.stream().map(component -> {
            Map<String, Object> resolved = new LinkedHashMap<>(component);
            if (resolved.get("example") instanceof Map<?, ?> example && example.get("header_handle") instanceof List<?> handles) {
                List<Object> resolvedHandles = handles.stream()
                        .map(h -> h instanceof String ref
                                ? attachmentRegistry.resolve(accountId, ref).map(v -> (Object) v).orElse(ref)
                                : h)
                        .toList();
                Map<String, Object> newExample = new LinkedHashMap<>((Map<String, Object>) example);
                newExample.put("header_handle", resolvedHandles);
                resolved.put("example", newExample);
            }
            if (resolved.get("cards") instanceof List<?> cards) {
                resolved.put("cards", cards.stream().map(card -> {
                    if (card instanceof Map<?, ?> cardMap && cardMap.get("components") instanceof List<?> cardComponents) {
                        Map<String, Object> newCard = new LinkedHashMap<>((Map<String, Object>) cardMap);
                        newCard.put("components", resolveAttachmentReferences(accountId, (List<Map<String, Object>>) cardComponents));
                        return newCard;
                    }
                    return card;
                }).toList());
            }
            return resolved;
        }).toList();
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): the model wrapped a BUTTONS
     * component's "buttons" array one level too deep -- {"buttons":[[{"type":
     * "URL",...}]]} instead of {"buttons":[{"type":"URL",...}]} -- while building
     * a CAROUSEL card on gpt-5.4-mini. Meta rejected it: "(#100) Unexpected key
     * \"0\" on param \"...['buttons'][0]\"" (it read buttons[0] as an object and
     * found a nested array/its numeric index instead). Flattens one level of
     * nested lists inside "buttons" regardless of how it got there, recursing
     * into CAROUSEL cards the same way resolveAttachmentReferences does.
     */
    @SuppressWarnings("unchecked")
    List<Map<String, Object>> flattenNestedButtonsArrays(List<Map<String, Object>> components) {
        return components.stream().map(component -> {
            Map<String, Object> result = component;
            if (component.get("buttons") instanceof List<?> buttons && buttons.stream().anyMatch(b -> b instanceof List)) {
                List<Object> flattened = buttons.stream()
                        .flatMap(b -> b instanceof List<?> nested ? nested.stream() : java.util.stream.Stream.of(b))
                        .map(b -> (Object) b)
                        .toList();
                result = new LinkedHashMap<>(component);
                result.put("buttons", flattened);
                log.info("flattenNestedButtonsArrays: flattened a doubly-nested buttons array");
            }
            if (result.get("cards") instanceof List<?> cards) {
                List<Object> newCards = cards.stream().map(card -> {
                    if (card instanceof Map<?, ?> cardMap && cardMap.get("components") instanceof List<?> cardComponents) {
                        Map<String, Object> newCard = new LinkedHashMap<>((Map<String, Object>) cardMap);
                        newCard.put("components", flattenNestedButtonsArrays((List<Map<String, Object>>) cardComponents));
                        return (Object) newCard;
                    }
                    return (Object) card;
                }).toList();
                if (result == component) {
                    result = new LinkedHashMap<>(component);
                }
                result.put("cards", newCards);
            }
            return result;
        }).toList();
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): prompt instructions alone did not
     * reliably stop the model from attaching an "example" key to a BODY component
     * with zero {{n}} placeholders -- across three live attempts it tried a
     * populated example.body_text, then an empty example:{}, then a populated one
     * again. Meta rejects ANY example key on a placeholder-free BODY regardless of
     * value (error_subcode 2388043), so this strips it unconditionally rather than
     * continuing to rely on the model reading the rule correctly every time.
     */
    private static final java.util.regex.Pattern PLACEHOLDER_PATTERN = java.util.regex.Pattern.compile("\\{\\{\\d+}}");

    List<Map<String, Object>> stripExampleFromPlaceholderFreeBody(List<Map<String, Object>> components) {
        return components.stream().map(component -> {
            if (!"BODY".equals(component.get("type")) || !(component.get("text") instanceof String text)) {
                return component;
            }
            if (PLACEHOLDER_PATTERN.matcher(text).find() || !component.containsKey("example")) {
                return component;
            }
            Map<String, Object> withoutExample = new LinkedHashMap<>(component);
            withoutExample.remove("example");
            log.info("stripExampleFromPlaceholderFreeBody: removed stray example key from a placeholder-free BODY");
            return withoutExample;
        }).toList();
    }

    /**
     * Defense-in-depth (2026-08-19, live-caught): the model can put HEADER/FOOTER/
     * BUTTONS data as a stray top-level sibling key next to "components" instead of
     * as a proper component object inside it -- e.g. a top-level "header":
     * {"type":"IMAGE","example":{...}} instead of a components entry
     * {"type":"HEADER","format":"IMAGE","example":{...}}. That stray key used to be
     * silently dropped (execute() only reads known top-level args), so Karix created
     * a template with NO header at all while Iris told the operator one was attached
     * -- confirmed live: templateId 1072082308622182 was created with only a BODY
     * component despite a real header_handle being supplied. This heals the shape
     * into the correct component instead of losing the operator's requested content.
     */
    List<Map<String, Object>> mergeStrayTopLevelComponents(Map<String, Object> args, List<Map<String, Object>> components) {
        List<Map<String, Object>> merged = new ArrayList<>(components);
        mergeStrayHeader(args, merged);
        mergeStraySimple(args, merged, "footer", "FOOTER");
        mergeStrayButtons(args, merged);
        return merged;
    }

    private boolean hasComponentType(List<Map<String, Object>> components, String type) {
        return components.stream().anyMatch(c -> type.equals(c.get("type")));
    }

    private void mergeStrayHeader(Map<String, Object> args, List<Map<String, Object>> components) {
        if (hasComponentType(components, "HEADER") || !(args.get("header") instanceof Map<?, ?> header)) {
            return;
        }
        Map<String, Object> headerComponent = new LinkedHashMap<>();
        headerComponent.put("type", "HEADER");
        headerComponent.put("format", header.get("format") != null ? header.get("format") : header.get("type"));
        header.forEach((k, v) -> {
            if (!"type".equals(k) && !"format".equals(k)) {
                headerComponent.put(String.valueOf(k), v);
            }
        });
        components.add(0, headerComponent);
        log.info("mergeStrayTopLevelComponents: healed a stray top-level 'header' key into a proper HEADER component");
    }

    private void mergeStraySimple(Map<String, Object> args, List<Map<String, Object>> components, String key, String type) {
        if (hasComponentType(components, type) || !(args.get(key) instanceof Map<?, ?> value)) {
            return;
        }
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", type);
        value.forEach((k, v) -> {
            if (!"type".equals(k)) {
                component.put(String.valueOf(k), v);
            }
        });
        components.add(component);
        log.info("mergeStrayTopLevelComponents: healed a stray top-level '{}' key into a proper {} component", key, type);
    }

    private void mergeStrayButtons(Map<String, Object> args, List<Map<String, Object>> components) {
        if (hasComponentType(components, "BUTTONS") || !(args.get("buttons") instanceof List<?> buttonsList)) {
            return;
        }
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BUTTONS");
        component.put("buttons", buttonsList);
        components.add(component);
        log.info("mergeStrayTopLevelComponents: healed a stray top-level 'buttons' key into a proper BUTTONS component");
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
