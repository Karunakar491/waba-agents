package com.metaagent.platform.domain.templatestudio.iris;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class IrisAttachmentRegistryTest {

    private final IrisAttachmentRegistry registry = new IrisAttachmentRegistry();

    @Test
    void resolves_a_registered_filename_for_the_same_account() {
        registry.register(1L, "photo.jpg", "real-handle");

        assertThat(registry.resolve(1L, "photo.jpg")).contains("real-handle");
    }

    @Test
    void does_not_resolve_across_different_accounts() {
        registry.register(1L, "photo.jpg", "account-1-handle");

        assertThat(registry.resolve(2L, "photo.jpg")).isEmpty();
    }

    @Test
    void returns_empty_for_an_unregistered_filename() {
        assertThat(registry.resolve(1L, "never-uploaded.jpg")).isEmpty();
    }

    @Test
    void a_later_upload_of_the_same_filename_overwrites_the_earlier_handle() {
        registry.register(1L, "photo.jpg", "old-handle");
        registry.register(1L, "photo.jpg", "new-handle");

        assertThat(registry.resolve(1L, "photo.jpg")).contains("new-handle");
    }
}
