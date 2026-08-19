package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the 2026-08-19 defense-in-depth fix: prompt instructions alone did
 * not reliably stop Iris from attaching an "example" key to a placeholder-free
 * BODY (populated, then empty, then populated again across three live
 * attempts) -- Meta rejects any example key there regardless of value.
 */
class TemplateStudioToolProviderExampleStripTest {

    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(null, null, null, null, null, null);

    private Map<String, Object> body(String text, Object example) {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BODY");
        component.put("text", text);
        if (example != null) {
            component.put("example", example);
        }
        return component;
    }

    @Test
    void removes_a_populated_example_from_a_placeholder_free_body() {
        var result = provider.stripExampleFromPlaceholderFreeBody(
                List.of(body("Enjoy our Iced Coffee!", Map.of("body_text", List.of(List.of("x"))))));

        assertThat(result.get(0)).doesNotContainKey("example");
    }

    @Test
    void removes_an_empty_example_from_a_placeholder_free_body() {
        var result = provider.stripExampleFromPlaceholderFreeBody(
                List.of(body("Enjoy our Iced Coffee!", Map.of())));

        assertThat(result.get(0)).doesNotContainKey("example");
    }

    @Test
    void keeps_example_when_body_actually_has_placeholders() {
        var withExample = body("Order {{1}} confirmed", Map.of("body_text", List.of(List.of("12345"))));

        var result = provider.stripExampleFromPlaceholderFreeBody(List.of(withExample));

        assertThat(result.get(0)).containsKey("example");
    }

    @Test
    void leaves_a_body_with_no_example_key_untouched() {
        var result = provider.stripExampleFromPlaceholderFreeBody(List.of(body("Enjoy our Iced Coffee!", null)));

        assertThat(result.get(0)).doesNotContainKey("example");
        assertThat(result.get(0)).containsEntry("text", "Enjoy our Iced Coffee!");
    }

    @Test
    void leaves_non_body_components_untouched() {
        Map<String, Object> footer = new LinkedHashMap<>();
        footer.put("type", "FOOTER");
        footer.put("text", "Reply STOP to unsubscribe");

        var result = provider.stripExampleFromPlaceholderFreeBody(List.of(footer));

        assertThat(result.get(0)).isEqualTo(footer);
    }
}
