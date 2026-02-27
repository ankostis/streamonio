---
name: release
description: use git to deduce the list of changes since last release and write then into `CHANGES.md`
---
## When to use this skill

When the user asked to prepare for a release and/or to update the "changes".

## Process

1. Establish the last release;  usually it's the last tagged commit, unless user specified other commit.

2. Collect all git changes since last release and summarize them into max 2 lines.  Since the header of each commit is limited to 50ish chars, consider also the lines the commit header, and ensure any shorthands in the title are expanded.

3. Merge related commits by domain (eg logging) per type.  Skip commits that fix errors introduced within this release cycle.


4. Sort collected changes in significance order which is a function of the message summary, and its type & scope:
   - capitals in the header increase its significance
   - the message conveys the importance, usually
   - type decreasing order: Breaking changes/drops, fixes, features, refacts, enhs, chores, doc, style
   - scope decreasing order: main code, testing, project admin, build machinery

5. Group together scope/functionality(eg "UI") related changes as sub-items of the most important change (regardless of type), unless there are multiple equally important changes for that scope, in which case they are kept separate.

6. Establish if there is already a section for the new release in `CHANGES.md` (this is the usual) and and merge with any commits already contained in the section, fill in the rest.

## Rules

- Reverse chronological order (newest release or TODOs at the top)

 ### Release title

 - Release title contain5 the current date and picks keywords from the most important changes (if there are any) to povide the big picture, like: `## v0.7.2 - (2026-02-24) Fix too-small hover, no statusbar;  add UI MCP test` using commas & semicolons to depict relevancy.  User will utilize the release title to issue a git tag command, like this: `git tag -sm v0.7.2 '(2026-02-24) Fix too-small hover, no statusbar;  add UI MCP test'`

### Body

- Lines <90ish chars
- dash-pullets for all changes collected above
- TODOs, performance & sizings(bytes & LoCs) reports at the bottom (but don's use verbatim sizings in certain commits without verification)
- add periods at the end of phrases containing verbs.
