package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the 2026-08-19 defense-in-depth fix: the model put HEADER data as a
 * stray top-level "header" key sibling to "components" instead of a proper
 * component inside it, which used to be silently dropped -- a template was
 * created live with NO header despite a real header_handle being supplied
 * (templateId 1072082308622182). This heals the shape instead of losing it.
 */
class TemplateStudioToolProviderMergeStrayComponentsTest {

    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(null, null, null, null, null);

    private Map<String, Object> body() {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BODY");
        component.put("text", "Enjoy our Iced Coffee!");
        return component;
    }

    @Test
    void merges_a_stray_top_level_header_into_a_proper_header_component() {
        Map<String, Object> strayHeader = new LinkedHashMap<>();
        strayHeader.put("type", "IMAGE");
        strayHeader.put("example", Map.of("header_handle", List.of("real-handle-123")));
        Map<String, Object> args = Map.of("header", strayHeader);

        var result = provider.mergeStrayTopLevelComponents(args, List.of(body()));

        var header = result.stream().filter(c -> "HEADER".equals(c.get("type"))).findFirst();
        assertThat(header).isPresent();
        assertThat(header.get()).containsEntry("format", "IMAGE");
        assertThat(header.get()).containsEntry("example", Map.of("header_handle", List.of("real-handle-123")));
    }

    @Test
    void does_not_touch_components_when_no_stray_keys_are_present() {
        var result = provider.mergeStrayTopLevelComponents(Map.of(), List.of(body()));

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).containsEntry("type", "BODY");
    }

    @Test
    void does_not_duplicate_a_header_that_is_already_correctly_placed() {
        Map<String, Object> correctHeader = new LinkedHashMap<>();
        correctHeader.put("type", "HEADER");
        correctHeader.put("format", "IMAGE");
        Map<String, Object> strayHeader = new LinkedHashMap<>();
        strayHeader.put("type", "IMAGE");
        Map<String, Object> args = Map.of("header", strayHeader);

        var result = provider.mergeStrayTopLevelComponents(args, List.of(correctHeader, body()));

        assertThat(result).hasSize(2);
        assertThat(result.stream().filter(c -> "HEADER".equals(c.get("type"))).count()).isEqualTo(1);
    }

    @Test
    void merges_a_stray_top_level_footer() {
        Map<String, Object> args = Map.of("footer", Map.of("text", "Reply STOP to unsubscribe"));

        var result = provider.mergeStrayTopLevelComponents(args, List.of(body()));

        var footer = result.stream().filter(c -> "FOOTER".equals(c.get("type"))).findFirst();
        assertThat(footer).isPresent();
        assertThat(footer.get()).containsEntry("text", "Reply STOP to unsubscribe");
    }

    @Test
    void merges_stray_top_level_buttons() {
        Map<String, Object> args = Map.of("buttons", List.of(Map.of("type", "QUICK_REPLY", "text", "Order Now")));

        var result = provider.mergeStrayTopLevelComponents(args, List.of(body()));

        var buttons = result.stream().filter(c -> "BUTTONS".equals(c.get("type"))).findFirst();
        assertThat(buttons).isPresent();
        assertThat(buttons.get().get("buttons")).isEqualTo(List.of(Map.of("type", "QUICK_REPLY", "text", "Order Now")));
    }
}
