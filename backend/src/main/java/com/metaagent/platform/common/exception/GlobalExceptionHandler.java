package com.metaagent.platform.common.exception;

import com.metaagent.platform.common.response.ApiResponse;
import com.metaagent.platform.domain.templatestudio.TemplateStudioException;
import com.metaagent.platform.infrastructure.meta.MetaApiErrorMessage;
import com.metaagent.platform.infrastructure.meta.MetaApiException;
import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(NotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(TemplateStudioException.class)
    public ResponseEntity<ApiResponse<Void>> handleTemplateStudio(TemplateStudioException ex) {
        // Logged in full here — the response body is deliberately never
        // returned to the client (karix-mcp's internal error shape must not
        // leak), but that meant it was going completely undiagnosed on
        // every failure. This is the ONLY place it should ever be logged.
        log.warn("TemplateStudioException: status={} body={}", ex.getStatusCode(), ex.getResponseBody());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ex.getMessage()));
    }

    /**
     * Must be declared as its own handler even though MetaApiException extends
     * BusinessException: otherwise handleBusiness below wins and the operator
     * gets "Meta API error: 400" while Meta's actual reason is discarded.
     * Spring picks the most specific handler, so this one takes it.
     */
    @ExceptionHandler(MetaApiException.class)
    public ResponseEntity<ApiResponse<Void>> handleMetaApi(MetaApiException ex) {
        // Full body at WARN, including the fbtrace_id that is left out of the
        // response — that is the part Meta support asks for.
        log.warn("MetaApiException: status={} body={}", ex.getStatusCode(), ex.getResponseBody());
        String message = MetaApiErrorMessage.describe(ex.getStatusCode(), ex.getResponseBody());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(message));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        // EL-caught gap (2026-08-07 audit): this used to return the client
        // message with zero server-side logging — a downstream failure (e.g.
        // TemplateStudioException wrapping a karix-mcp/Meta rejection) was
        // invisible in app.log entirely, undiagnosable after the fact.
        log.warn("BusinessException: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .findFirst()
                .orElse("Validation failed");
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(message));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> handleConstraint(ConstraintViolationException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ApiResponse.error(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleUnexpected(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ApiResponse.error("Internal server error"));
    }
}
