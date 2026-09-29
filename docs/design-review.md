# ShareNotes Architecture Design Review

**Review date:** September 9, 2026  
**Reviewer:** GitHub Copilot Chat, senior architecture review  
**Inputs:** [requirements.md](requirements.md), [architecture.md](architecture.md)

## Review Scope

The review evaluated whether the proposed architecture is ready to support the required note lifecycle:

- Authenticated note creation, editing, and deletion
- Public read-only access through unique share links
- Owner-only mutation authorization
- A backend-enforced 30 MB aggregate note limit including attachments
- Link invalidation after deletion

The review also examined security, consistency, attachment lifecycle, API behavior, caching, operations, deployment, and testability.

## Findings

### Critical Findings

1. **Concurrency control was not concrete.** The original architecture mentioned optimistic locking but did not define conflict detection or the client response. Silent last-write-wins behavior could lose edits.
2. **Cache invalidation was underspecified.** The architecture warned about stale public content without defining cache headers or a validation strategy. Cached content could outlive an update or deletion.
3. **Attachment cleanup failure handling was incomplete.** The deletion flow mentioned a retryable job without defining its queue, SLA, monitoring, or recovery path. This could leave orphaned private objects and ongoing storage cost.
4. **Share-link revocation and expiry were open questions.** Owners had no defined way to revoke a link without deleting the note, and the access lifetime was ambiguous.

### High-Severity Findings

5. **Deletion semantics were contradictory.** The requirements say permanent removal while the architecture left soft versus hard deletion open. The implementation needs an explicit lifecycle and clear public behavior.
6. **Rich-text sanitization was too general.** The architecture did not specify whether content is sanitized on read or write, which sanitizer is used, or the allowed HTML model.
7. **Attachment file validation lacked an allowlist.** Extension and MIME validation were mentioned without defining permitted types or magic-byte verification.
8. **Deployment and migration rollback were unspecified.** The deployment view did not define a release strategy, migration compatibility rule, or rollback target.
9. **Session lifetime and CSRF controls were unspecified.** Cookie attributes alone do not define session expiry, rotation, logout invalidation, or state-changing request protection.
10. **Rate limiting was not implementable as written.** The architecture named protected operations but did not define identities, endpoint limits, distributed enforcement, or `429` behavior.

### Medium and Low Findings

11. Direct-to-object-storage uploads need a separate design because they can bypass aggregate-size validation and create unfinalized objects.
12. Audit events, retention, and access control need explicit definitions.
13. Critical database indexes and query-performance checks should be documented.
14. API error responses need a stable schema with machine-readable codes and trace IDs.
15. Signed attachment URL lifetime and access limits need defined values.
16. REST content types, compression, CORS, and conditional requests need consistent rules.
17. Test data, integration database, API contract testing, storage mocking, and end-to-end coverage need a defined strategy.
18. The note-list endpoint needs pagination, sorting, and a metadata-only response contract.
19. Observability needs actionable alert thresholds.
20. Real-time collaborative editing should be explicitly out of scope for v1.
21. Scaling, connection pooling, and instance-sizing guidance belongs in the deployment runbook.
22. OpenAPI, operational runbook, ADRs, development setup, and schema documentation should be implementation deliverables.

## Agreed Design Decisions

The following decisions are adopted for the v1 architecture and are reflected in [architecture.md](architecture.md):

| Area | Decision | Reason |
| --- | --- | --- |
| Edit consistency | Use an integer `version` for optimistic locking. Updates require the current version and return `409 Conflict` on mismatch. | Prevents silent overwrites. |
| Public caching | Use `Cache-Control: no-cache, must-revalidate` and ETags for shared-note responses at launch. | Ensures updates and deletions are revalidated before display. |
| Deletion | Mark notes deleted immediately with `deleted_at`; return `404` for deleted notes and links. Permanently purge records and objects after 60 days. | Meets public deletion behavior while preserving a controlled recovery/audit window. |
| Share links | Links are permanent by default but independently revocable by the owner. Store `revoked_at`; revoked links return `404`. | Gives owners access control without requiring note deletion. |
| Attachment cleanup | Queue object deletion after note deletion with a one-hour target, retries, dead-letter handling, and orphan metrics. | Avoids blocking user deletion while making failures visible and recoverable. |
| Rich text | Store the editor document format; sanitize on API output and frontend rendering with an explicit allowlist. | Protects against stored XSS while preserving structured content. |
| Attachments | v1 accepts PDF, TXT, MD, JPG, PNG, GIF, and WebP only; validate extension, declared type, and magic bytes. | Reduces the upload attack surface. |
| Upload path | Route v1 uploads through the API. Defer presigned uploads until a separate aggregate-size and cleanup design exists. | Keeps the 30 MB check authoritative and simple. |
| Sessions | Use one-hour access sessions, optional 30-day refresh sessions, secure cookies, rotation, logout invalidation, and CSRF protection. | Balances usability and session security. |
| Abuse controls | Use distributed per-IP and per-user/token rate limits with `429` and `Retry-After`. | Protects authentication, creation, sharing, and public reads. |
| Deployment | Use blue-green API deployment and backward-compatible N/N-1 database migrations, with a tested rollback target under 10 minutes. | Reduces release and migration risk. |
| Collaboration | Real-time multi-user editing is out of scope for v1; version conflicts are surfaced to the client. | Keeps the first release focused and testable. |
| Testing | Publish an OpenAPI contract and cover unit, integration, contract, security, and Playwright end-to-end flows in CI. | Makes the architecture verifiable before production. |

## Review Outcome

**Verdict:** Conditionally approved for implementation planning. The high-level architecture is appropriate, but production coding should begin only after the decisions above are reflected in detailed API schemas, database migrations, security tests, and operational runbooks.

**Implementation gate:** No production code until the final checklist is reviewed and the remaining implementation tasks are assigned.
