---
name: summarize
description: prepare a commit message and write it into `SUMMARY.md`
---
## When to use this skill

When the user asked to prepare a commit and/or summarize [some changes].

## Process

1. Deduce which changes should the message regard (ask if unclear):
  - git-workspace with `git --diff` cmd
  - git-index with `git diff --staged`, or
  - the last prompt(s)
2. Establish if `SUMMARY.md` is empty or contains pre-existing msg, and if this need to be updated or replaced (ask if unclear)
3. Write/update the message `SUMMARY.md` following rules below.

## Rules

### Header (1st line):
- Format: semantic commits like `type(scope) phrase` or `type: phrase` (<50 chars)
- Types: fix/refact/feat/enh/drop/chore/doc/style
- End with ` >` if body follows; `;` separates distinct changes

### Body:
- Lines <90ish chars
- Present tense (changes), past tense (bugs)
- Big picture first, succinct, use "etc"
- "What" only if non-obvious (skip file listings), focus on "Why"
- NO `#` headers (vim rebase issues), backticks for code, *italics* for concepts, **bold** for emphasis
- Bullets for actions, paragraphs for explanations
- In lists, add periods at the end of phrases containing verbs.
- TODOs, performance & sizings(bytes & LoCs) reports at the bottom
