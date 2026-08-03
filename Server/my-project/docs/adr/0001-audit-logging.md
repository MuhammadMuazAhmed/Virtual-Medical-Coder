# ADR 0001: HIPAA Audit Logging Architecture & Data Model

- **Status**: Accepted (Locked Phase 0 & Phase 1 Setup)
- **Date**: 2026-08-03
- **Author**: Senior Healthcare Software Architect
- **Context**: MedCoder Medical Coding SaaS Platform

---

## Context & HIPAA Audit Requirements

As a production medical coding SaaS platform operating in healthcare environments, MedCoder handles Sensitive Protected Health Information (PHI) under HIPAA regulations (specifically 45 CFR § 164.312(b) Audit Controls). The system must record and examine activity in information systems that contain or use electronic protected health information (ePHI).

This ADR records the foundational architectural decisions (Phase 0) and data model design (Phase 1) for the MedCoder Audit Logging subsystem.

---

## Phase 0 Locked Architectural Decisions & Rationale

### Decision 1: Retention Strategy (6-Year Retention, Hot Storage)
- **Decision**: Audit logs are retained for a minimum of 6 years to comply with HIPAA mandatory retention rules. For initial deployment, all audit logs reside hot within MongoDB in the `auditlogs` collection.
- **Rationale**: Storing logs hot in MongoDB avoids premature operational complexity (e.g., maintaining separate S3 archival pipelines or cold storage ingestion jobs) while maintaining fast query capability for compliance audits. Schema documents are self-contained with denormalized user snapshots so historical queries never rely on live joins to mutated or deleted records.
- **Revisit Trigger**: Revisit when `auditlogs` collection storage size/cost impacts cluster performance, or prior to initiating a SOC 2 Type II audit process.

### Decision 2: Storage Location & Database-Level Permissions
- **Decision**: Audit logs reside in the primary MedCoder MongoDB cluster in a dedicated `auditlogs` collection (not a separate database cluster or microservice).
- **Mandate**: At the database deployment / DBA permission level, application runtime write credentials must be granted `INSERT` privilege only on `auditlogs`, with explicit prohibition of `UPDATE` and `DELETE` privileges.
- **Rationale**: Keeps architecture simple and transactional for initial launch while establishing defense-in-depth immutability at the MongoDB user-privilege tier.
- **Revisit Trigger**: Revisit prior to onboarding the first enterprise hospital customer or before starting SOC 2 audit readiness — specifically evaluating migration to a physically isolated audit service or write-once-read-many (WORM) storage.

### Decision 3: Access Control & Separation of Duties
- **Decision**: Extend the system `User` role enum to include `compliance_officer` (`doctor | admin | compliance_officer`). Audit log READ access is restricted strictly to `compliance_officer`. The `admin` role explicitly DOES NOT receive audit log access by default.
- **Rationale**: Enforces HIPAA administrative safeguards for separation of duties. System administrators who manage users or infrastructure should not have inherent authority to inspect audit logs or tamper with audit trails unnoticed. A single account holding both `admin` and `compliance_officer` roles is prohibited under the single-role enum model.
- **Revisit Trigger**: Revisit when a full RBAC multi-role / granular permission system is built for MedCoder, evaluating whether `compliance_officer` should transition from a role enum to a permission grant.

### Decision 4: Synchronous Inline Write Mode & Error Handling
- **Decision**: Audit log writes occur synchronously (`await`) inline within the active HTTP request context. If an audit write fails, it is caught and logged loudly via `console.error` with prefix `[AUDIT LOG WRITE FAILURE]` without throwing or crashing the user request.
- **Rationale**: Synchronous execution guarantees non-repudiation and prevents audit record loss during unexpected container crashes. Non-throwing error handling ensures database hiccups do not fail patient care workflows while loud, structured error outputs guarantee immediate visibility in SIEM and log monitoring systems (e.g., Datadog, Sentry, CloudWatch).
- **Revisit Trigger**: Revisit if p99 request latency degradation attributable to audit writes becomes measurable, or write volume exceeds single-document insert capacity. Any future async model must use a durable, persistent queue (e.g., AWS SQS or Kafka) — unbuffered fire-and-forget is strictly prohibited.

---

## Out of Scope for Phase 0 & Phase 1

The following capabilities are explicitly deferred to future implementation phases:
1. **API Route Wiring & Middleware**: Wiring `recordAuditEvent` into Next.js API routes or HTTP request middleware.
2. **Query / Read API Endpoints**: Building compliance dashboard endpoints or audit search filters for `compliance_officer` users.
3. **Automated Archival / Retention Jobs**: Scheduled cron jobs moving logs older than 6 years to S3/Cold Storage.
4. **Multi-Role RBAC Refactor**: Refactoring user roles from a single string enum to array-based multi-role assignments.

---

## Verification & Compliance Checklist

- [x] Exhaustive `AuditAction` enum defined (`src/lib/audit/auditActions.ts`)
- [x] `User.ts` extended with `compliance_officer` role
- [x] Immutable `AuditLog.ts` Mongoose schema with indexes & `strict: true`
- [x] Centralized `recordAuditEvent` helper with non-throwing error handling
- [x] Architecture Decision Record finalized (`docs/adr/0001-audit-logging.md`)
