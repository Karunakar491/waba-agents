package com.metaagent.platform.domain.client.controller;

import com.metaagent.platform.common.exception.BusinessException;
import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.client.dto.ClientDtos;
import com.metaagent.platform.domain.client.entity.Client;
import com.metaagent.platform.domain.client.entity.ClientAuditLog;
import com.metaagent.platform.domain.client.entity.ClientStaff;
import com.metaagent.platform.domain.client.service.ClientService;
import com.metaagent.platform.domain.user.entity.User;
import com.metaagent.platform.domain.user.repository.UserRepository;
import com.metaagent.platform.domain.waba.dto.WabaDtos;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/clients")
@RequiredArgsConstructor
public class ClientController {

    private final ClientService clientService;
    private final UserRepository userRepository;

    @PostMapping
    public ApiResponse<ClientDtos.ClientResponse> create(@Valid @RequestBody ClientDtos.CreateRequest request) {
        Client client = clientService.create(request.name(), parseId(request.wabaId(), "WABA"));
        return ApiResponse.ok(toResponse(client));
    }

    @GetMapping
    public ApiResponse<List<ClientDtos.ClientResponse>> list() {
        return ApiResponse.ok(clientService.listForCaller().stream().map(ClientController::toResponse).toList());
    }

    @GetMapping("/{id}")
    public ApiResponse<ClientDtos.ClientDetailResponse> get(@PathVariable String id) {
        Long clientId = parseId(id, "Client");
        Client client = clientService.getDetail(clientId);
        List<ClientDtos.StaffResponse> staff = clientService.getStaff(clientId).stream()
                .map(this::toStaffResponse)
                .toList();
        return ApiResponse.ok(new ClientDtos.ClientDetailResponse(toResponse(client), staff));
    }

    @PutMapping("/{id}")
    public ApiResponse<ClientDtos.ClientResponse> update(@PathVariable String id, @Valid @RequestBody ClientDtos.UpdateRequest request) {
        Client client = clientService.update(parseId(id, "Client"), request.name(), parseStatus(request.creditLineStatus()));
        return ApiResponse.ok(toResponse(client));
    }

    @GetMapping("/{id}/phones")
    public ApiResponse<List<WabaDtos.PhoneNumber>> getPhones(@PathVariable String id) {
        return ApiResponse.ok(clientService.getPhoneNumbers(parseId(id, "Client")));
    }

    @GetMapping("/{id}/audit-log")
    public ApiResponse<List<ClientDtos.AuditEntryResponse>> getAuditLog(@PathVariable String id) {
        List<ClientAuditLog> entries = clientService.getAuditLog(parseId(id, "Client"));
        return ApiResponse.ok(entries.stream()
                .map(e -> new ClientDtos.AuditEntryResponse(String.valueOf(e.getChangedBy()), e.getChangeSummary(), e.getChangedAt().toString()))
                .toList());
    }

    @PostMapping("/{id}/staff")
    public ApiResponse<Void> addStaff(@PathVariable String id, @Valid @RequestBody ClientDtos.StaffAccessRequest request) {
        clientService.addStaffAccess(parseId(id, "Client"), parseId(request.userId(), "User"));
        return ApiResponse.ok();
    }

    @DeleteMapping("/{id}/staff/{userId}")
    public ApiResponse<Void> removeStaff(@PathVariable String id, @PathVariable String userId) {
        clientService.removeStaffAccess(parseId(id, "Client"), parseId(userId, "User"));
        return ApiResponse.ok();
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private static Long parseId(String value, String label) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            throw new BusinessException(label + " id is invalid");
        }
    }

    private static Client.CreditLineStatus parseStatus(String value) {
        try {
            return Client.CreditLineStatus.valueOf(value);
        } catch (IllegalArgumentException e) {
            throw new BusinessException("Invalid credit line status");
        }
    }

    private ClientDtos.StaffResponse toStaffResponse(ClientStaff cs) {
        String email = userRepository.findById(cs.getUserId()).map(User::getEmail).orElse(null);
        return new ClientDtos.StaffResponse(String.valueOf(cs.getUserId()), email);
    }

    private static ClientDtos.ClientResponse toResponse(Client client) {
        return new ClientDtos.ClientResponse(
                String.valueOf(client.getId()),
                client.getName(),
                client.getWabaId() != null ? String.valueOf(client.getWabaId()) : null,
                client.getCreditLineStatus().name(),
                String.valueOf(client.getCreatedBy()),
                String.valueOf(client.getUpdatedBy()),
                client.getCreatedAt().toString(),
                client.getUpdatedAt().toString()
        );
    }
}
