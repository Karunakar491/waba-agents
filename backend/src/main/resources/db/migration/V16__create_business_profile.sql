CREATE TABLE business_profile (
    id                          BIGINT UNSIGNED NOT NULL,
    account_id                  BIGINT UNSIGNED NULL, -- NULL only for archived rows discovered live on Meta with no local owner ("unmanaged")
    phone_number_id             VARCHAR(64) NULL,
    status                      VARCHAR(16) NOT NULL,
    payment_method              TEXT NULL,
    return_policy               TEXT NULL,
    purchase_info               TEXT NULL,
    delivery_and_shipping       TEXT NULL,
    business_description        TEXT NULL,
    contact_email               VARCHAR(255) NULL,
    contact_hours_of_operation  VARCHAR(255) NULL,
    contact_address             VARCHAR(512) NULL,
    deployed_at                 DATETIME NULL,
    archived_at                 DATETIME NULL,
    created_at                  DATETIME NOT NULL,
    updated_at                  DATETIME NOT NULL,
    PRIMARY KEY (id),
    INDEX idx_business_profile_account (account_id),
    INDEX idx_business_profile_phone_status (phone_number_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
