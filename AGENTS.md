# AGENTS.md

## Project
POD Design Checker
Next.js App Router + TypeScript

## Important user rules
- Beginner coder
- No big refactors
- One small safe change at a time
- Prefer editing one file only unless absolutely necessary
- Explain plan first for complex tasks
- Keep existing working UI intact
- Do not remove features unless asked
- Preserve current button/viewMode system
- Preserve POD Canvas / Design Only / Shirt Preview modes

## Workflow rules
- Read existing code before changing anything
- For larger tasks, make a plan first
- After edits, run the relevant checks
- Prefer minimal diffs
- If unsure, stop and explain instead of guessing

## Current priorities
- Keep app as a quick-check tool, not a full editor
- Focus on print-readiness and confidence
- Maintain compact UI
- Improve layout safely
- Improve loading-state messaging
- Improve upload button styling
- Improve download button wording/location
- Keep zoom up to 800%
- Avoid breaking scan logic

## Known preferences
- Use the word "folder" not directory
- Use the phrase "text document" not doc

## Handover notes

### Safe restore habits
- Always make a git save before major edits
- Keep backup file if needed, e.g. `app/page-save.tsx`
- Test in `npm run dev` after each change

### Main file structure
- `app/page.tsx` = working main file
- `app/page-save.tsx` = backup
- `app/lib/podCheckerUtils.ts`
- `app/lib/podCheckerTypes.ts`
- `app/components/ScanResultsPanel.tsx`
- `app/components/DesignPreviewPanel.tsx`
- `app/components/TopControlsPanel.tsx`

### Current app purpose
- Fast print-readiness and design confidence checker for POD

### Do not drift into
- mockup builder
- full editor

### Important working features
- POD Canvas
- Design Only
- Shirt Preview
- print confidence / readiness logic
- fix tools like auto-fix border, center, quick fix

### Current UI direction
- 3-column layout
- left and right fixed width
- middle flexible
- reduce scrolling
- compact info chips instead of large bars
