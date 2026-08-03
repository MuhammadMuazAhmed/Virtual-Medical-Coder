import { Types } from "mongoose";
import AuditLog, { AuditChangesSnapshot } from "../../models/AuditLog";
import { AuditActionType, AuditResourceTypeType } from "./auditActions";

/**
 * Parameter interface for recording an audit event.
 * Enforces compile-time type checking for all required audit fields.
 */
export interface RecordAuditEventParams {
    actorId: string | Types.ObjectId;
    actorRole: string;
    actorEmail: string;
    action: AuditActionType;
    resourceType: AuditResourceTypeType;
    resourceId?: string;
    patientId?: string | Types.ObjectId;
    changes?: AuditChangesSnapshot;
    outcome: "SUCCESS" | "FAILURE" | "DENIED";
    failureReason?: string;
    ipAddress: string;
    userAgent?: string;
    requestId?: string;
}

/**
 * Synchronously records an immutable audit event into the MedCoder `auditlogs` collection.
 * 
 * ARCHITECTURAL DESIGN & COMPLIANCE MANDATES:
 * 
 * 1. SINGLE WRITE PATH:
 *    This function is the sole authorized writer for audit events across the platform. No application
 *    route, background task, or service method should construct or persist `AuditLog` documents directly.
 *    Centralizing writes guarantees consistent schema adherence, denormalization standards, and failure handling.
 * 
 * 2. SYNCHRONOUS INLINE EXECUTION:
 *    Audit log writes are awaited inline within the request execution context. In accordance with Phase 0 decisions
 *    and HIPAA compliance auditing requirements, actions are audited synchronously at the time of execution to
 *    prevent event loss or non-repudiation vulnerabilities inherent in unbuffered fire-and-forget queues.
 * 
 * 3. NON-THROWING LOUD FAILURE LOGGING:
 *    If the audit log write fails (e.g., database connection timeout or schema validation issue), this function
 *    catches the exception and logs loudly to `console.error` with the `[AUDIT LOG WRITE FAILURE]` prefix.
 *    It explicitly DOES NOT rethrow the error to caller routes.
 *    Reasoning: A database glitch writing an audit entry must not cause an end-user request to fail or crash.
 *    However, emitting structured, high-severity error logs ensures log-monitoring agents (Datadog, CloudWatch, Sentry)
 *    immediately alert DevOps and Compliance officers to audit system anomalies.
 * 
 * @param params Audit details matching the AuditLog schema fields.
 * @returns Promise resolving to void upon completion or silent fail-safe catch.
 */
export async function recordAuditEvent(params: RecordAuditEventParams): Promise<void> {
    try {
        await AuditLog.create({
            actorId: typeof params.actorId === "string" ? new Types.ObjectId(params.actorId) : params.actorId,
            actorRole: params.actorRole,
            actorEmail: params.actorEmail,
            action: params.action,
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            patientId: params.patientId
                ? typeof params.patientId === "string"
                    ? new Types.ObjectId(params.patientId)
                    : params.patientId
                : undefined,
            changes: params.changes,
            outcome: params.outcome,
            failureReason: params.failureReason,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
            requestId: params.requestId,
            timestamp: new Date(),
        });
    } catch (error) {
        // Log loudly with structured prefix for SIEM / Log Monitoring systems.
        // DO NOT THROW: preserve user request flow while exposing failure to ops monitoring.
        console.error("[AUDIT LOG WRITE FAILURE] Failed to write audit log entry:", {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            eventPayload: {
                actorId: String(params.actorId),
                actorEmail: params.actorEmail,
                action: params.action,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                outcome: params.outcome,
                requestId: params.requestId,
                timestamp: new Date().toISOString(),
            },
        });
    }
}
