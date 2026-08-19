package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the 2026-08-19 defense-in-depth fix: the prompt only ever taught an
 * "[Attached image: ...]" tag convention, so when an operator attached a
 * document, Iris guessed at a shape and emitted a top-level
 * {"type":"DOCUMENT","header_handle":[...]} component instead of the correct
 * {"type":"HEADER","format":"DOCUMENT","example":{"header_handle":[...]}}.
 * Meta rejected it loud ("Unexpected key \"header_handle\" on param
 * \"components[1]\"") -- no data was lost, but it's still a real gap.
 */
class TemplateStudioToolProviderNormalizeMediaHeaderTest {

    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(null, null, null, null, null, null);

    private Map<String, Object> body() {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BODY");
        component.put("text", "Check out our full catalog!");
        return component;
    }

    @Test
    void heals_a_top_level_document_type_with_bare_header_handle() {
        Map<String, Object> stray = new LinkedHashMap<>();
        stray.put("type", "DOCUMENT");
        stray.put("header_handle", List.of("real-handle-abc"));

        var result = provider.normalizeMediaHeaderComponents(List.of(body(), stray));

        var header = result.stream().filter(c -> "HEADER".equals(c.get("type"))).findFirst();
        assertThat(header).isPresent();
        assertThat(header.get()).containsEntry("format", "DOCUMENT");
        assertThat(header.get()).containsEntry("example", Map.of("header_handle", List.of("real-handle-abc")));
    }

    @Test
    void heals_a_top_level_video_type_with_nested_example_handle() {
        Map<String, Object> stray = new LinkedHashMap<>();
        stray.put("type", "VIDEO");
        stray.put("example", Map.of("header_handle", List.of("video-handle-xyz")));

        var result = provider.normalizeMediaHeaderComponents(List.of(stray, body()));

        var header = result.stream().filter(c -> "HEADER".equals(c.get("type"))).findFirst();
        assertThat(header).isPresent();
        assertThat(header.get()).containsEntry("format", "VIDEO");
        assertThat(header.get()).containsEntry("example", Map.of("header_handle", List.of("video-handle-xyz")));
    }

    @Test
    void leaves_a_correctly_shaped_header_component_untouched() {
        Map<String, Object> correctHeader = new LinkedHashMap<>();
        correctHeader.put("type", "HEADER");
        correctHeader.put("format", "IMAGE");
        correctHeader.put("example", Map.of("header_handle", List.of("real-handle")));

        var result = provider.normalizeMediaHeaderComponents(List.of(correctHeader, body()));

        assertThat(result).containsExactly(correctHeader, body());
    }

    @Test
    void leaves_unrelated_components_untouched() {
        var result = provider.normalizeMediaHeaderComponents(List.of(body()));

        assertThat(result).containsExactly(body());
    }
}
