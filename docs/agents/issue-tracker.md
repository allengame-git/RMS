# Issue tracker: GitHub

Issues and specs live in GitHub Issues for `allengame-git/RMS`. Use the `gh` CLI from this clone; outside the clone, pass `--repo allengame-git/RMS`.

## Conventions

- Create: `gh issue create --title "..." --body-file <path>`.
- Read: `gh issue view <number> --comments`; fetch structured fields with `--json number,title,body,labels,comments` when needed.
- List: `gh issue list --state open --json number,title,body,labels,comments`, with appropriate `--label` and `--state` filters.
- Comment: `gh issue comment <number> --body-file <path>`.
- Apply or remove labels: `gh issue edit <number> --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number>`; add a closing comment when authorized.

For multiline bodies, write the exact text to a temporary file and pass `--body-file`. Preserve actual newlines. Use `docs/agents/triage-labels.md` for triage role mappings.

These conventions describe how to perform authorized tracker work; setup itself does not create issues, labels, or comments. Sending comments requires explicit user authorization.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares issue and PR numbers. If a supplied number is ambiguous, resolve it with `gh pr view <number>` and fall back to `gh issue view <number>`.

## Skill terminology

- "Publish to the issue tracker": create a GitHub issue.
- "Fetch the relevant ticket": run `gh issue view <number> --comments`.

## Wayfinding operations

- Map: one issue labelled `wayfinder:map`, containing Notes, Decisions-so-far, and Fog.
- Child ticket: link to the map as a GitHub sub-issue. If unavailable, use a task list in the map and `Part of #<map>` in the child body. Labels use `wayfinder:<type>` (`research`, `prototype`, `grilling`, or `task`).
- Blocking: prefer native GitHub issue dependencies when available; otherwise record `Blocked by: #<number>` in the child body. A ticket is unblocked when all blockers are closed.
- Frontier: list the map's open children in map order, excluding assigned tickets and tickets with open blockers.
- Claim: assign the ticket to the driving developer with `gh issue edit <number> --add-assignee @me`.
- Resolve: record the answer, close the ticket, and append a concise finding and link to the map's Decisions-so-far, within the user's authorized scope.
