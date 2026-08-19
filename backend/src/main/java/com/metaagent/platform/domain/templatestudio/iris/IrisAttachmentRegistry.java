package com.metaagent.platform.domain.templatestudio.iris;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Holds real Meta media handles server-side, keyed by account + the original
 * filename, so Iris never has to type the ~150-character opaque handle itself.
 *
 * Live-caught (2026-08-19): asking the model to reproduce a real header_handle
 * verbatim in its tool call is unreliable at any tier -- gpt-5.4-mini corrupted
 * a single character mid-handle (a Z/r transposition) while copying one into a
 * CAROUSEL card, and Meta rejected the whole template as "Uploaded media handle
 * is invalid". The fix isn't a better prompt -- an LLM byte-for-byte copying a
 * long random token is inherently unreliable. Instead, the model is taught to
 * reference the file by its short, human-readable filename (already visible in
 * the "[Attached image: ...]" tag), and TemplateStudioToolProvider resolves
 * that filename back to the real handle here before ever building the Karix
 * payload -- the model never sees or retypes the actual handle value.
 *
 * In-memory and account-scoped rather than tied to one Iris session or
 * persisted: an upload happens before any session necessarily exists (the
 * frontend uploads media up front, independent of the chat turn -- see
 * TemplateIrisPage's uploadAttachment), and Meta's own handles are themselves
 * short-lived, so there is no durability requirement here beyond a single
 * working conversation. A server restart losing this is equivalent to the
 * operator re-attaching the file, which they would need to do anyway once a
 * real Meta handle itself expires.
 */
@Component
public class IrisAttachmentRegistry {

    private static final Duration TTL = Duration.ofMinutes(30);

    private record StoredHandle(String handle, Instant uploadedAt) {}

    private final Map<Long, Map<String, StoredHandle>> byAccount = new ConcurrentHashMap<>();

    public void register(Long accountId, String fileName, String handle) {
        if (fileName == null || handle == null) {
            return;
        }
        byAccount.computeIfAbsent(accountId, id -> new ConcurrentHashMap<>())
                .put(fileName, new StoredHandle(handle, Instant.now()));
    }

    public Optional<String> resolve(Long accountId, String fileName) {
        Map<String, StoredHandle> forAccount = byAccount.get(accountId);
        if (forAccount == null || fileName == null) {
            return Optional.empty();
        }
        StoredHandle stored = forAccount.get(fileName);
        if (stored == null || Duration.between(stored.uploadedAt(), Instant.now()).compareTo(TTL) > 0) {
            return Optional.empty();
        }
        return Optional.of(stored.handle());
    }
}
