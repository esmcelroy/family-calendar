# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd prime` for full workflow context.

## Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work atomically
bd close <id>         # Complete work
bd graph --all --html > /tmp/bd-board.html && open /tmp/bd-board.html  # View board
```

## Viewing Boards

There is no `bd board` command. To view issues as an interactive dependency graph:

```bash
bd graph --all --html > /tmp/bd-board.html && open /tmp/bd-board.html
```

This opens a self-contained D3.js HTML visualization in your browser.
For a text summary: `bd list --status=open` or `bd status`.

## Fresh Clone / System Restart Recovery

Beads uses a Dolt SQL server (`bd dolt status` to check). On a fresh clone or if the DB is empty:

```bash
bd import .beads/backup/issues.jsonl   # Restore issues from git-tracked JSONL
bd info                                # Verify issue count
```

The server auto-starts on demand at port 60995 (pinned in `.beads/config.yaml`).

## Session Close — Portable Export

**Do NOT use `bd dolt push`** — no Dolt remote is configured; the command will error.
Instead, export the JSONL snapshot and commit it with git:

```bash
git pull --rebase
bd export -o .beads/backup/issues.jsonl
git add .beads/backup/issues.jsonl
git diff --cached --quiet || git commit -m "beads: export issues snapshot"
git push
```

## Non-Interactive Shell Commands

**ALWAYS use non-interactive flags** with file operations to avoid hanging on confirmation prompts.

Shell commands like `cp`, `mv`, and `rm` may be aliased to include `-i` (interactive) mode on some systems, causing the agent to hang indefinitely waiting for y/n input.

**Use these forms instead:**
```bash
# Force overwrite without prompting
cp -f source dest           # NOT: cp source dest
mv -f source dest           # NOT: mv source dest
rm -f file                  # NOT: rm file

# For recursive operations
rm -rf directory            # NOT: rm -r directory
cp -rf source dest          # NOT: cp -r source dest
```

**Other commands that may prompt:**
- `scp` - use `-o BatchMode=yes` for non-interactive
- `ssh` - use `-o BatchMode=yes` to fail instead of prompting
- `apt-get` - use `-y` flag
- `brew` - use `HOMEBREW_NO_AUTO_UPDATE=1` env var

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL agent task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- `bd` works **alongside** GitHub Issues (user-facing bugs/features) and speckit (spec/planning artifacts) — track work in all three as appropriate
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd export -o .beads/backup/issues.jsonl  # Export beads snapshot
   git add .beads/backup/issues.jsonl
   git diff --cached --quiet || git commit -m "beads: export issues snapshot"
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
