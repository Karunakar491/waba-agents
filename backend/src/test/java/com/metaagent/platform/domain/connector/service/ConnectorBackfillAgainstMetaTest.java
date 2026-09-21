package com.metaagent.platform.domain.connector.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Real Meta payloads, captured from production on 2026-09-20, run through the
 * real parsing code.
 *
 * Written because a mock only ever proves the code agrees with my own guess
 * about Meta. When these payloads were actually fetched they contradicted the
 * plan twice: two IndiaMART connectors that our database says are deployed
 * return 404 from Meta, and nested body params come back as recursively
 * JSON-ENCODED STRINGS rather than inline objects —
 *
 *   "properties":{"day":"{\"type\":\"integer\"}"}
 *
 * which is exactly the encoding the codebase warned was unverified. Neither
 * would have surfaced against a hand-written fixture.
 *
 * Source: GET /{phoneNumberId}/agent_connectors/{id}/tools for the live
 * IndiaMART and Astrotalk connectors. Captured verbatim; do not "tidy" these
 * strings — their shape IS the assertion.
 */
class ConnectorBackfillAgainstMetaTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    private ConnectorBackfillService service() {
        ConnectorBackfillService s = new ConnectorBackfillService(null, null, null, null, objectMapper);
        ReflectionTestUtils.setField(s, "enabled", true);
        return s;
    }

    /** Invokes the real private parser rather than reimplementing it here. */
    private String parse(Object requestDefinition) {
        return (String) ReflectionTestUtils.invokeMethod(service(), "readDefinition", requestDefinition);
    }

    // -------------------------------------------------------------------------
    // Verbatim production payloads
    // -------------------------------------------------------------------------

    /** IndiaMART product_search — the one IndiaMART connector Meta still has. */
    private static final String INDIAMART_PRODUCT_SEARCH = """
            {"method":"POST","path":"/","body":{"content_type":"application/json","params":{
              "action":{"type":"string","description":"Fixed action selector required by the endpoint.",
                        "binding":{"kind":"default","value":"product-search"}},
              "city":{"type":"string","description":"Buyer city."}}}}
            """;

    /**
     * Astrotalk general_kundli. The nested "detail" object's properties are
     * JSON-encoded STRINGS, not objects. This is the shape that would have been
     * invented wrongly by hand.
     */
    private static final String ASTROTALK_KUNDLI = """
            {"method":"POST","path":"/v1/combined/general","body":{"content_type":"application/json","params":{
              "detail":{"type":"object","properties":{
                 "day":"{\\"type\\":\\"integer\\"}",
                 "gender":"{\\"type\\":\\"string\\"}",
                 "hour":"{\\"type\\":\\"integer\\"}",
                 "lat":"{\\"type\\":\\"number\\"}"}}}}}
            """;

    /** Astrotalk find_payment_link — query parameters only, no body. */
    private static final String RAZORPAY_FIND_LINK = """
            {"method":"GET","path":"/v1/payment_links","query_parameters":{
              "reference_id":{"type":"string","description":"The reconstructible booking reference."}}}
            """;

    // -------------------------------------------------------------------------

    @Test
    void should_store_a_real_meta_definition_unchanged() throws Exception {
        Object asMeta = objectMapper.readValue(INDIAMART_PRODUCT_SEARCH, Map.class);

        String stored = parse(asMeta);

        assertNotNull(stored, "the one IndiaMART connector Meta still has must import");
        JsonNode back = objectMapper.readTree(stored);
        assertEquals("POST", back.get("method").asText());
        // The binding that makes the tool actually work must survive.
        assertEquals("product-search",
                back.at("/body/params/action/binding/value").asText());
    }

    @Test
    void should_preserve_metas_json_encoded_nested_strings_exactly() throws Exception {
        Object asMeta = objectMapper.readValue(ASTROTALK_KUNDLI, Map.class);

        String stored = parse(asMeta);

        assertNotNull(stored);
        JsonNode day = objectMapper.readTree(stored).at("/body/params/detail/properties/day");
        // STILL a string, not an object. Re-encoding this into what we THINK
        // Meta wants is the bet the codebase explicitly says not to take.
        assertTrue(day.isTextual(), "nested property must stay JSON-encoded as Meta sent it, got: " + day);
        assertEquals("{\"type\":\"integer\"}", day.asText());
    }

    @Test
    void should_handle_a_definition_with_no_body() throws Exception {
        Object asMeta = objectMapper.readValue(RAZORPAY_FIND_LINK, Map.class);

        String stored = parse(asMeta);

        assertNotNull(stored);
        assertEquals("GET", objectMapper.readTree(stored).get("method").asText());
    }

    @Test
    void should_accept_the_same_definition_whether_meta_sends_an_object_or_a_string() throws Exception {
        // Meta's encoding is not contractually fixed, so both must land identically.
        Object asObject = objectMapper.readValue(RAZORPAY_FIND_LINK, Map.class);

        assertEquals(parse(asObject), parse(RAZORPAY_FIND_LINK.trim()));
    }

    @Test
    void should_refuse_anything_that_is_not_a_json_object() {
        // A tool we cannot read is skipped, never stored as "{}" — an empty
        // object is a valid-looking payload that would be pushed to Meta on the
        // next deploy as a tool that silently does nothing.
        assertNull(parse(null));
        assertNull(parse(""));
        assertNull(parse("not json at all"));
        assertNull(parse(List.of(1, 2, 3)));
        assertNull(parse("[1,2,3]"));
    }
}
