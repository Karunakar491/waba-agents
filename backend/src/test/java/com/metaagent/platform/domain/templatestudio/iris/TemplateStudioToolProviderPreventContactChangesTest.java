package com.metaagent.platform.domain.templatestudio.iris;

import com.metaagent.platform.domain.templatestudio.TemplateStudioService;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Covers the 2026-08-19 defense-in-depth fix for the scariest bug this
 * session: even with get_template + explicit "reuse existing components
 * verbatim" instructions, Iris still fabricated a DIFFERENT phone number on
 * a real APPROVED template when asked only to add a footer -- caught and
 * cancelled before confirming, but only by luck. edit_template's whole
 * components array now always gets checked against a fresh, authoritative
 * get_template fetch (never trusting what the model claims), restoring the
 * real phone_number/url for any button type that already existed.
 */
class TemplateStudioToolProviderPreventContactChangesTest {

    private final TemplateStudioService templateStudioService = mock(TemplateStudioService.class);
    private final TemplateStudioToolProvider provider =
            new TemplateStudioToolProvider(templateStudioService, null, null, null, null, null);

    private Map<String, Object> originalTemplateResult(Map<String, Object> button) {
        Map<String, Object> buttonsComponent = new LinkedHashMap<>();
        buttonsComponent.put("type", "BUTTONS");
        buttonsComponent.put("buttons", List.of(button));
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("components", List.of(buttonsComponent));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("response", response);
        Map<String, Object> full = new LinkedHashMap<>();
        full.put("result", result);
        return full;
    }

    @Test
    void restores_the_real_phone_number_when_the_model_submits_a_different_one() {
        Map<String, Object> realButton = Map.of("type", "PHONE_NUMBER", "text", "Call Us", "phone_number", "+919152004195");
        when(templateStudioService.getTemplate(anyLong(), any())).thenReturn(originalTemplateResult(realButton));

        Map<String, Object> fabricatedButton = new LinkedHashMap<>();
        fabricatedButton.put("type", "PHONE_NUMBER");
        fabricatedButton.put("phone_number", "+911234567890");
        Map<String, Object> submittedButtons = new LinkedHashMap<>();
        submittedButtons.put("type", "BUTTONS");
        submittedButtons.put("buttons", List.of(fabricatedButton));

        var result = provider.preventSilentButtonContactChanges(1L, "template-1", List.of(submittedButtons));

        List<?> buttons = (List<?>) result.get(0).get("buttons");
        assertThat(((Map<?, ?>) buttons.get(0)).get("phone_number")).isEqualTo("+919152004195");
    }

    @Test
    void restores_the_real_url_when_the_model_submits_a_different_one() {
        Map<String, Object> realButton = Map.of("type", "URL", "text", "Shop", "url", "https://real-shop.example.com");
        when(templateStudioService.getTemplate(anyLong(), any())).thenReturn(originalTemplateResult(realButton));

        Map<String, Object> fabricatedButton = new LinkedHashMap<>();
        fabricatedButton.put("type", "URL");
        fabricatedButton.put("url", "https://made-up.example.com");
        Map<String, Object> submittedButtons = new LinkedHashMap<>();
        submittedButtons.put("type", "BUTTONS");
        submittedButtons.put("buttons", List.of(fabricatedButton));

        var result = provider.preventSilentButtonContactChanges(1L, "template-1", List.of(submittedButtons));

        List<?> buttons = (List<?>) result.get(0).get("buttons");
        assertThat(((Map<?, ?>) buttons.get(0)).get("url")).isEqualTo("https://real-shop.example.com");
    }

    @Test
    void allows_a_brand_new_button_type_that_did_not_exist_before() {
        Map<String, Object> realButton = Map.of("type", "PHONE_NUMBER", "phone_number", "+919152004195");
        when(templateStudioService.getTemplate(anyLong(), any())).thenReturn(originalTemplateResult(realButton));

        Map<String, Object> newButton = new LinkedHashMap<>();
        newButton.put("type", "URL");
        newButton.put("url", "https://example.com/new");
        Map<String, Object> submittedButtons = new LinkedHashMap<>();
        submittedButtons.put("type", "BUTTONS");
        submittedButtons.put("buttons", List.of(newButton));

        var result = provider.preventSilentButtonContactChanges(1L, "template-1", List.of(submittedButtons));

        List<?> buttons = (List<?>) result.get(0).get("buttons");
        assertThat(((Map<?, ?>) buttons.get(0)).get("url")).isEqualTo("https://example.com/new");
    }

    @Test
    void does_not_touch_components_when_the_original_fetch_fails() {
        when(templateStudioService.getTemplate(anyLong(), any())).thenThrow(new RuntimeException("not found"));

        Map<String, Object> button = new LinkedHashMap<>();
        button.put("type", "PHONE_NUMBER");
        button.put("phone_number", "+911234567890");
        Map<String, Object> submittedButtons = new LinkedHashMap<>();
        submittedButtons.put("type", "BUTTONS");
        submittedButtons.put("buttons", List.of(button));

        var result = provider.preventSilentButtonContactChanges(1L, "template-1", List.of(submittedButtons));

        assertThat(result).isEqualTo(List.of(submittedButtons));
    }

    @Test
    void leaves_matching_values_untouched() {
        Map<String, Object> realButton = Map.of("type", "PHONE_NUMBER", "phone_number", "+919152004195");
        when(templateStudioService.getTemplate(anyLong(), any())).thenReturn(originalTemplateResult(realButton));

        Map<String, Object> sameButton = new LinkedHashMap<>();
        sameButton.put("type", "PHONE_NUMBER");
        sameButton.put("phone_number", "+919152004195");
        Map<String, Object> submittedButtons = new LinkedHashMap<>();
        submittedButtons.put("type", "BUTTONS");
        submittedButtons.put("buttons", List.of(sameButton));

        var result = provider.preventSilentButtonContactChanges(1L, "template-1", List.of(submittedButtons));

        List<?> buttons = (List<?>) result.get(0).get("buttons");
        assertThat(((Map<?, ?>) buttons.get(0)).get("phone_number")).isEqualTo("+919152004195");
    }
}
