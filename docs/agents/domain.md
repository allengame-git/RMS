# Domain Docs

This repository uses a single-context layout: `CONTEXT.md` at the repository root for domain vocabulary, and `docs/adr/` for architecture decisions.

## Before exploring

Read root `CLAUDE.md` for project rules, then `CONTEXT.md` if present and ADRs in `docs/adr/` relevant to the area being explored.

If domain documents do not exist, proceed silently. Do not flag their absence or suggest creating them upfront. The `domain-modeling` skill creates them lazily when terms or decisions are resolved.

## Vocabulary

Use the glossary's terms in issue titles, proposals, hypotheses, and test names. If a needed concept is missing, reconsider whether the project uses that concept; record a real terminology gap for `domain-modeling`.

## ADR conflicts

If a proposal contradicts an existing ADR, identify the ADR and explain why the decision should be revisited. Surface conflicts with the project rules in `CLAUDE.md` explicitly as well.
