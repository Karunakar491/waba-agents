package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the 2026-08-19 defense-in-depth fix: asking Iris to retype a real
 * ~150-character Meta media handle verbatim is unreliable at any model tier --
 * gpt-5.4-mini corrupted a single character mid-handle while building a
 * CAROUSEL card, and Meta rejected the whole template as an invalid handle.
 * Instead, the model puts the short filename in header_handle and this
 * resolves it back to the real handle server-side via IrisAttachmentRegistry.
 */
class TemplateStudioToolProviderResolveAttachmentReferencesTest {

    private final IrisAttachmentRegistry registry = new IrisAttachmentRegistry();
    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(null, null, null, registry, null, null);
    private static final Long ACCOUNT_ID = 42L;

    private Map<String, Object> header(String handleRef) {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "HEADER");
        component.put("format", "IMAGE");
        component.put("example", Map.of("header_handle", List.of(handleRef)));
        return component;
    }

    @Test
    void resolves_a_registered_filename_to_the_real_handle() {
        registry.register(ACCOUNT_ID, "strawberry.jpeg", "real-handle-abc123");

        var result = provider.resolveAttachmentReferences(ACCOUNT_ID, List.of(header("strawberry.jpeg")));

        Map<?, ?> example = (Map<?, ?>) result.get(0).get("example");
        assertThat(example.get("header_handle")).isEqualTo(List.of("real-handle-abc123"));
    }

    @Test
    void leaves_an_unregistered_reference_unchanged_rather_than_guessing() {
        var result = provider.resolveAttachmentReferences(ACCOUNT_ID, List.of(header("unknown.jpeg")));

        Map<?, ?> example = (Map<?, ?>) result.get(0).get("example");
        assertThat(example.get("header_handle")).isEqualTo(List.of("unknown.jpeg"));
    }

    @Test
    void resolves_references_inside_carousel_cards() {
        registry.register(ACCOUNT_ID, "card1.jpeg", "real-handle-1");
        registry.register(ACCOUNT_ID, "card2.jpeg", "real-handle-2");

        Map<String, Object> card1 = new LinkedHashMap<>();
        card1.put("components", List.of(header("card1.jpeg")));
        Map<String, Object> card2 = new LinkedHashMap<>();
        card2.put("components", List.of(header("card2.jpeg")));

        Map<String, Object> carousel = new LinkedHashMap<>();
        carousel.put("type", "CAROUSEL");
        carousel.put("cards", List.of(card1, card2));

        var result = provider.resolveAttachmentReferences(ACCOUNT_ID, List.of(carousel));

        List<?> resolvedCards = (List<?>) result.get(0).get("cards");
        Map<?, ?> resolvedCard1Header = (Map<?, ?>) ((List<?>) ((Map<?, ?>) resolvedCards.get(0)).get("components")).get(0);
        Map<?, ?> resolvedCard2Header = (Map<?, ?>) ((List<?>) ((Map<?, ?>) resolvedCards.get(1)).get("components")).get(0);
        assertThat(((Map<?, ?>) resolvedCard1Header.get("example")).get("header_handle")).isEqualTo(List.of("real-handle-1"));
        assertThat(((Map<?, ?>) resolvedCard2Header.get("example")).get("header_handle")).isEqualTo(List.of("real-handle-2"));
    }

    @Test
    void leaves_a_component_with_no_example_key_untouched() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "BODY");
        body.put("text", "Enjoy our sale!");

        var result = provider.resolveAttachmentReferences(ACCOUNT_ID, List.of(body));

        assertThat(result).containsExactly(body);
    }
}
