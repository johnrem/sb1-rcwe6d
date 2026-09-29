# sb1-rcwe6d

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/johnrem/sb1-rcwe6d)
## Content Studio

Open the app and choose **Content Studio** in the sidebar (or go to `/#studio`). It's a workspace for making ads, scripts and other content from many sources, with full version history.

- **Sources** (left): connect a folder (Chrome/Edge auto-sync new and changed files; other browsers do a one-time import), drop or upload files (text, Markdown, CSV, images, PDFs, `.srt`/`.vtt` captions), add YouTube videos (paste the transcript from YouTube's *Show transcript*), or paste notes. Tick a source to use it in the current piece, and add a per-source note about how to use it.
- **Editor** (centre): each project has several pieces. Each piece has a format preset, brief, audience, tone, length and a variation count. **Generate** streams a draft from Claude. The **Refine** bar and quick chips revise the draft in place.
- **Version history** (right): every generation, refinement, restore and manual save (Ctrl/Cmd+S) is kept as a snapshot. You can star, rename, compare (word diff) and restore any of them. Duplicating a piece branches it.
- **Guidelines**: per-project rules sent with every generation (brand voice, facts, banned words).
- **Settings**: your Anthropic API key (stored only in this browser), model, effort, and sync interval.

All data lives in the browser's IndexedDB. Use *Export project backup* in the project menu to save a JSON copy.
