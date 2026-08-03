/**
 * Single source-of-truth TypeScript controlled vocabularies for audit logging within MedCoder.
 * 
 * DESIGN RATIONALE:
 * Every auditable event across the platform must reference values from these enums.
 * Using string-backed enums ensures both strong compile-time type safety in TypeScript
 * and readable, self-describing string values stored in MongoDB.
 * 
 * Adding a new action or resource type in the future is a simple one-line enum addition, requiring no DB schema migrations.
 */
export enum AuditAction {
    // --- Authentication Events ---
    LOGIN_SUCCESS = "LOGIN_SUCCESS",
    LOGIN_FAILURE = "LOGIN_FAILURE",
    LOGOUT = "LOGOUT",

    // --- Patient Management Events ---
    PATIENT_VIEW = "PATIENT_VIEW",
    PATIENT_LIST_VIEW = "PATIENT_LIST_VIEW",
    PATIENT_CREATE = "PATIENT_CREATE",
    PATIENT_UPDATE = "PATIENT_UPDATE",
    PATIENT_DELETE = "PATIENT_DELETE",

    // --- Medical Record & Coding Events ---
    RECORD_VIEW = "RECORD_VIEW",
    RECORD_LIST_VIEW = "RECORD_LIST_VIEW",
    RECORD_CREATE = "RECORD_CREATE",
    RECORD_UPDATE = "RECORD_UPDATE",
    RECORD_DELETE = "RECORD_DELETE",
    RECORD_APPROVE = "RECORD_APPROVE",
    RECORD_UPLOAD = "RECORD_UPLOAD",

    // --- Code Database Management (ICD-10 / CPT) ---
    CODE_DATABASE_VIEW = "CODE_DATABASE_VIEW",
    CODE_DATABASE_CREATE = "CODE_DATABASE_CREATE",
    CODE_DATABASE_UPDATE = "CODE_DATABASE_UPDATE",
    CODE_DATABASE_DELETE = "CODE_DATABASE_DELETE",

    // --- User Administration Events ---
    USER_ROLE_CHANGE = "USER_ROLE_CHANGE",
    USER_ACTIVATE = "USER_ACTIVATE",
    USER_DEACTIVATE = "USER_DEACTIVATE",
    USER_DELETE = "USER_DELETE",

    // --- Security & Authorization Events ---
    AUTHORIZATION_DENIED = "AUTHORIZATION_DENIED",

    // --- Meta / Compliance Events ---
    AUDIT_LOG_QUERY = "AUDIT_LOG_QUERY",
}

/**
 * Type helper for audit action values.
 */
export type AuditActionType = `${AuditAction}`;

/**
 * Array of valid audit action values for runtime schema validation.
 */
export const ALL_AUDIT_ACTIONS = Object.values(AuditAction);

/**
 * Controlled vocabulary for resource types associated with audit actions.
 */
export enum AuditResourceType {
    PATIENT = "Patient",
    RECORD = "Record",
    USER = "User",
    CODE_DATABASE = "CodeDatabase",
    AUTH = "Auth",
    AUDIT_LOG = "AuditLog",
}

/**
 * Type helper for audit resource type values.
 */
export type AuditResourceTypeType = `${AuditResourceType}`;

/**
 * Array of valid audit resource type values for runtime schema validation.
 */
export const ALL_AUDIT_RESOURCE_TYPES = Object.values(AuditResourceType);
