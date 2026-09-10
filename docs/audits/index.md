# Audit index

These reports capture evidence and conclusions from specific points in time:

* [Repository inventory](../../REPOSITORY_INVENTORY.md) — complete repository inventory and initial file classifications.
* [Repository cleanup plan](../../REPOSITORY_CLEANUP_PLAN.md) — prioritised cleanup plan, later analysis, and documented corrections to the earlier inventory.
* [Backend test isolation report](../../TEST_ISOLATION_REPORT.md) — isolation design and the recorded 75-test backend baseline.
* [Frontend verification baseline](../../FRONTEND_VERIFICATION_BASELINE.md) — local toolchain, explicit typecheck diagnostics, guarded build blocker, and local-only smoke harness status before Batch 4.
* [Groups debug-route security remediation](../../SECURITY_REMEDIATION_DEBUG_ROUTES.md) — scope, evidence, and verification for removal of the exposed group debug routes.
* [Ticketing engine audit](TICKETING_ENGINE_AUDIT_REPORT.md) — dated 20 August 2026; retained as point-in-time ticketing evidence, not current architectural authority.
* [Historical backend audit](historical/BACKEND_AUDIT_REPORT.md) — dated 10 February 2026; retained for historical comparison, not as a guarantee of current behaviour.

Audit reports are point-in-time evidence. The current source tree and [authoritative context](../../events_hub_context.md) take precedence when later verified changes supersede an audit. Where stated, `REPOSITORY_CLEANUP_PLAN.md` corrects findings or interpretations in the earlier inventory.

The audit date, scope, and limitations inside each report remain part of its provenance.
