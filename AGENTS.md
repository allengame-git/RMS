# AGENTS.md

Guidance for Codex (and any non-Claude agent) working in this repository.

**Single source of truth: read `CLAUDE.md` in the repo root and follow it.** It contains the project overview, commands, architecture, domain rules, conventions, and the security checklist. This file intentionally contains no copy of that content — earlier duplicated versions drifted and caused real errors (backups: `.claude/backups/AGENTS.md.2026-07-03*.bak`).

Codex-specific notes:

- Codex agent definitions (code reviewers) live in `.codex/agents/*.toml`. The Claude Code equivalents are in `.claude/agents/*.md`; keep the review scope descriptions in sync when editing either set.
- The routing table at the top of `CLAUDE.md` points to detailed guides under `.claude/guides/` (delegation rules, judgment rubrics, maintenance protocol). They are written to be tool-agnostic; follow them where your harness has equivalent capabilities, and ignore Claude-Code-only tool references (e.g., the `Agent` tool's `model` parameter values).
- Do not edit `CLAUDE.md` structure or this file's role without asking the user first (see `.claude/guides/maintenance-protocol.md`).
