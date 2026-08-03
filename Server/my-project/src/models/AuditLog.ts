import mongoose, { Schema, Document, Types } from "mongoose";
import { ALL_AUDIT_ACTIONS, ALL_AUDIT_RESOURCE_TYPES, AuditActionType, AuditResourceTypeType } from "../lib/audit/auditActions";

/**
 * Changes snapshot structure for update actions.
 * Stores before and after states of modified fields.
 */
export interface AuditChangesSnapshot {
    before?: Record<string, any>;
    after?: Record<string, any>;
}

/**
 * AuditLog interface extending Mongoose Document.
 * Represents an immutable, self-contained record of a system or user event.
 */
export interface AuditLog extends Document {
    actorId: Types.ObjectId;
    actorRole: string;
    actorEmail: string;
    action: AuditActionType;
    resourceType: AuditResourceTypeType;
    resourceId?: string;
    patientId?: Types.ObjectId;
    changes?: AuditChangesSnapshot;
    outcome: "SUCCESS" | "FAILURE" | "DENIED";
    failureReason?: string;
    ipAddress: string;
    userAgent?: string;
    requestId?: string;
    timestamp: Date;
}

const auditLogSchema = new Schema<AuditLog>(
    {
        // actorId: The authenticated user who performed the action. Required for attribution and HIPAA accountability.
        actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },

        // actorRole: Denormalized snapshot of user role AT THE TIME of the action.
        // User roles may change over time; denormalization avoids invalid historical attribution via live joins.
        actorRole: { type: String, required: true },

        // actorEmail: Denormalized snapshot of email AT THE TIME of the action.
        // Email may change; denormalizing ensures historical logs retain exact identity snapshot.
        actorEmail: { type: String, required: true },

        // action: Controlled action string, enforced via AuditAction enum values.
        action: {
            type: String,
            required: true,
            enum: ALL_AUDIT_ACTIONS,
        },

        // resourceType: Type of entity involved (e.g., "Patient", "Record", "User", "CodeDatabase", "Auth", "AuditLog"). Enforced via AuditResourceType enum.
        resourceType: {
            type: String,
            required: true,
            enum: ALL_AUDIT_RESOURCE_TYPES,
        },

        // resourceId: Primary identifier of the affected entity. Optional because bulk queries (PATIENT_LIST_VIEW)
        // or unauthenticated failures (LOGIN_FAILURE) do not target a single resource ID.
        resourceId: { type: String, required: false },

        // patientId: Explicit direct reference to Patient. Optional, but populated for any patient-related action
        // (including indirect actions via Record). Allows fast "show all activity for Patient X" queries without Record joins.
        patientId: { type: Schema.Types.ObjectId, ref: "Patient", required: false },

        // changes: Before/after state snapshot of modified fields for update/edit operations.
        changes: {
            before: { type: Schema.Types.Mixed, required: false },
            after: { type: Schema.Types.Mixed, required: false },
        },

        // outcome: Result of the attempted action. Critical for security monitoring and access denied tracking.
        outcome: {
            type: String,
            required: true,
            enum: ["SUCCESS", "FAILURE", "DENIED"],
        },

        // failureReason: Detailed reason when outcome is FAILURE or DENIED (e.g., "invalid credentials", "unauthorized").
        failureReason: { type: String, required: false },

        // ipAddress: Origin IP address of client request. Required for security audit trails.
        ipAddress: { type: String, required: true },

        // userAgent: Browser / client user agent string. Optional metadata for client context.
        userAgent: { type: String, required: false },

        // requestId: Trace ID / HTTP request ID correlating audit log entry with application log streams.
        requestId: { type: String, required: false },

        // timestamp: Exact time event occurred. Immutable, defaults to creation time.
        timestamp: {
            type: Date,
            required: true,
            default: Date.now,
            immutable: true,
        },
    },
    {
        // Explicit strict mode enforced: Audit log entries must adhere strictly to the schema (no arbitrary fields).
        strict: true,

        // Collection name explicitly set as required by Phase 0 decisions.
        collection: "auditlogs",

        // Disabling automatic timestamps (createdAt / updatedAt). Audit logs represent point-in-time events;
        // they must NEVER have an updatedAt field because audit entries are immutable and never updated.
        timestamps: false,
    }
);

/* ==========================================================================
   INDEXES FOR EFFICIENT HIPAA AUDIT QUERY PATTERNS & RETENTION AUTOMATION
   ========================================================================== */

// 1. Patient Audit Trail: Fast lookup for "show all activity touching patient X" over time
auditLogSchema.index({ patientId: 1, timestamp: -1 });

// 2. User Activity Trail: Fast lookup for "everything user Y did" over time
auditLogSchema.index({ actorId: 1, timestamp: -1 });

// 3. Security Event Trail: Fast lookup for "all events of type Z (e.g. LOGIN_FAILURE or AUTHORIZATION_DENIED)"
auditLogSchema.index({ action: 1, timestamp: -1 });

// 4. Date Range & Archival Querying: Efficient range scans for date-based reporting and future retention archival
auditLogSchema.index({ timestamp: 1 });


/* ==========================================================================
   DEFENSE-IN-DEPTH: IMMUTABILITY ENFORCEMENT AT MONGOOSE LEVEL
   ========================================================================== */

// Prevent query-level updates (e.g., updateOne, updateMany, findOneAndUpdate)
auditLogSchema.pre("updateOne", function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be modified or updated.");
});
auditLogSchema.pre("updateMany", function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be modified or updated.");
});
auditLogSchema.pre("findOneAndUpdate", function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be modified or updated.");
});

// Prevent document-level updates on existing instances
auditLogSchema.pre("save", function (this: any) {
    if (!this.isNew) {
        throw new Error("AUDIT_LOG_IMMUTABLE: Existing audit log records cannot be updated.");
    }
});

// Prevent query-level and document-level deletions
// Note: This closes the gap where the original implementation only blocked updates, not deletes.
// This is application-layer defense-in-depth only — the real enforcement remains the DBA-level
// MongoDB permission grant (insert-only, no update/delete) documented in ADR 0001, Decision 2,
// which must be configured separately at the database/infrastructure level and is not something
// Mongoose hooks alone can guarantee (since raw driver access or admin tools bypass Mongoose entirely).
auditLogSchema.pre("deleteOne", { document: false, query: true }, function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be deleted.");
});
auditLogSchema.pre("deleteMany", { document: false, query: true }, function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be deleted.");
});
auditLogSchema.pre("findOneAndDelete", function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be deleted.");
});
auditLogSchema.pre("deleteOne", { document: true, query: false }, function (this: any) {
    throw new Error("AUDIT_LOG_IMMUTABLE: Audit logs are read-only append-only records and cannot be deleted.");
});

export default mongoose.models.AuditLog || mongoose.model<AuditLog>("AuditLog", auditLogSchema);
