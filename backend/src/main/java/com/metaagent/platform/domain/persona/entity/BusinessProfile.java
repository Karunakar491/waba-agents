package com.metaagent.platform.domain.persona.entity;

import com.fasterxml.jackson.databind.annotation.JsonSerialize;
import com.fasterxml.jackson.databind.ser.std.ToStringSerializer;
import com.metaagent.platform.common.id.TsidGenerator;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.GenericGenerator;

import java.time.LocalDateTime;

@Entity
@Table(name = "business_profile")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BusinessProfile {

    public enum Status { DRAFT, DEPLOYED, ARCHIVED }

    @Id
    @GenericGenerator(name = "tsid", type = TsidGenerator.class)
    @GeneratedValue(generator = "tsid")
    @JsonSerialize(using = ToStringSerializer.class)
    private Long id;

    @Column(name = "account_id")
    private Long accountId; // null only for ARCHIVED rows discovered live on Meta with no local owner ("unmanaged")

    @Column(name = "phone_number_id")
    private String phoneNumberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name = "payment_method", columnDefinition = "TEXT")
    private String paymentMethod;

    @Column(name = "return_policy", columnDefinition = "TEXT")
    private String returnPolicy;

    @Column(name = "purchase_info", columnDefinition = "TEXT")
    private String purchaseInfo;

    @Column(name = "delivery_and_shipping", columnDefinition = "TEXT")
    private String deliveryAndShipping;

    @Column(name = "business_description", columnDefinition = "TEXT")
    private String businessDescription;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_hours_of_operation")
    private String contactHoursOfOperation;

    @Column(name = "contact_address", length = 512)
    private String contactAddress;

    @Column(name = "deployed_at")
    private LocalDateTime deployedAt;

    @Column(name = "archived_at")
    private LocalDateTime archivedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = Status.DRAFT;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
