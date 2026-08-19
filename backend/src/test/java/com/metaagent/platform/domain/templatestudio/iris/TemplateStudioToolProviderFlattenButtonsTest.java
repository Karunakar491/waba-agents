package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Covers the 2026-08-19 defense-in-depth fix: gpt-5.4-mini wrapped a BUTTONS
 * component's "buttons" array one level too deep -- {"buttons":[[{"type":
 * "URL",...}]]} instead of {"buttons":[{"type":"URL",...}]} -- while building
 * a CAROUSEL card. Meta rejected it: "Unexpected key \"0\"" on the buttons[0]
 * path (it read the nested array as an object).
 */
class TemplateStudioToolProviderFlattenButtonsTest {

    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(null, null, null, null, null, null);

    private Map<String, Object> urlButton() {
        return Map.of("type", "URL", "text", "Shop now", "url", "https://example.com/shop");
    }

    @Test
    void flattens_a_doubly_nested_buttons_array() {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BUTTONS");
        component.put("buttons", List.of(List.of(urlButton())));

        var result = provider.flattenNestedButtonsArrays(List.of(component));

        assertThat(result.get(0).get("buttons")).isEqualTo(List.of(urlButton()));
    }

    @Test
    void leaves_a_correctly_flat_buttons_array_untouched() {
        Map<String, Object> component = new LinkedHashMap<>();
        component.put("type", "BUTTONS");
        component.put("buttons", List.of(urlButton()));

        var result = provider.flattenNestedButtonsArrays(List.of(component));

        assertThat(result.get(0).get("buttons")).isEqualTo(List.of(urlButton()));
    }

    @Test
    void flattens_nested_buttons_inside_carousel_cards() {
        Map<String, Object> nestedButtons = new LinkedHashMap<>();
        nestedButtons.put("type", "BUTTONS");
        nestedButtons.put("buttons", List.of(List.of(urlButton())));

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("components", List.of(nestedButtons));

        Map<String, Object> carousel = new LinkedHashMap<>();
        carousel.put("type", "CAROUSEL");
        carousel.put("cards", List.of(card));

        var result = provider.flattenNestedButtonsArrays(List.of(carousel));

        List<?> resolvedCards = (List<?>) result.get(0).get("cards");
        Map<?, ?> resolvedButtons = (Map<?, ?>) ((List<?>) ((Map<?, ?>) resolvedCards.get(0)).get("components")).get(0);
        assertThat(resolvedButtons.get("buttons")).isEqualTo(List.of(urlButton()));
    }

    @Test
    void leaves_a_component_with_no_buttons_key_untouched() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "BODY");
        body.put("text", "Enjoy our sale!");

        var result = provider.flattenNestedButtonsArrays(List.of(body));

        assertThat(result).containsExactly(body);
    }
}
