# Architecture documentation

[events_hub_context.md](../../events_hub_context.md) is the primary architecture and project-context source. [AGENT_RULES.md](../../AGENT_RULES.md) and [.agents/AGENTS.md](../../.agents/AGENTS.md) define constraints for repository work. [SYSTEM_MAP.md](../../SYSTEM_MAP.md) provides a navigational overview of specific documented features and integrations.

The documented system consists of a Next.js Pages Router frontend and a FastAPI backend using SQLModel/SQLAlchemy with PostgreSQL. Database change history includes Alembic revisions and the existing SQL migration path; their overlap and bootstrap safety remain under review.

Current documentation covers event, venue, and group functionality, native ticketing, and typed ingestion interfaces. Event scrapers live in a separate project and currently run manually. This repository contains the application-side ingestion boundaries; scraper implementation and automation are outside this architecture index.

This index points to the authoritative sources rather than duplicating their detailed rules.
