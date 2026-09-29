export interface FormatPreset {
  id: string;
  label: string;
  guidance: string;
}

export const FORMATS: FormatPreset[] = [
  {
    id: 'promo-reel',
    label: 'Promo reel / trailer (video)',
    guidance:
      'A 30–90 second promo edit plan. Start with a one-line concept and target runtime. Then a numbered shot list as a table: time in the reel, SOURCE (video title + [mm:ss] timestamp from its transcript, or "b-roll needed"), what we see, on-screen text, and audio (VO line / music / SFX). Cold open on the most intense moment, escalate pace, and use hard cuts on impacts. End on the strongest unresolved moment, then an end card with CTA. After the table: full VO script, music direction, and 3 caption/title options. Only cite timestamps that appear in the sources.',
  },
  {
    id: 'explainer',
    label: 'Explainer video script',
    guidance:
      'A 60–180 second explainer. Hook question, then 3–5 beats that each explain one idea, with a visual for each beat (cite source video + [mm:ss] where footage exists), on-screen text, and a clear takeaway and CTA at the end.',
  },
  {
    id: 'recap',
    label: 'Recap / "previously on"',
    guidance:
      'A 45–120 second recap of the story so far: the key rivalries, upsets and standings in chronological beats, each tied to a source clip + [mm:ss] timestamp, with VO and an ending that sets up what comes next.',
  },
  {
    id: 'compilation',
    label: 'Compilation / best-of plan',
    guidance:
      'A best-of compilation plan: title and thumbnail concept, running order of segments (source video + [mm:ss] in/out points), a short intro and transitions between segments, and chapters for the description.',
  },
  {
    id: 'cutdowns',
    label: 'Social cutdown pack (Shorts / Reels)',
    guidance:
      '5 vertical 15–30 second cutdowns. For each: source video + [mm:ss] in/out, the hook in the first 2 seconds, on-screen caption text, and a post caption with hashtags. Each must stand alone.',
  },
  {
    id: 'social-ad',
    label: 'Social ad (Meta / Instagram)',
    guidance: 'Primary text (hook in the first line, under 125 characters before the fold), headline (max 40 characters), description (max 30 characters), and a call-to-action button label.',
  },
  {
    id: 'google-ads',
    label: 'Google search ad',
    guidance: 'Up to 15 headlines (max 30 characters each) and 4 descriptions (max 90 characters each). Show the character count after each line.',
  },
  {
    id: 'youtube-preroll',
    label: 'YouTube pre-roll script',
    guidance: 'A 15–30 second spoken script. Hook in the first 5 seconds before the skip button. Include [VISUAL] cues and on-screen text, and end with a clear CTA.',
  },
  {
    id: 'short-video',
    label: 'Short-form video (Shorts / Reels / TikTok)',
    guidance: 'Script under 60 seconds with a pattern-interrupt hook, beat-by-beat shots, on-screen captions and a caption/description with hashtags.',
  },
  {
    id: 'youtube-meta',
    label: 'YouTube title, description & tags',
    guidance: '5 title options (under 70 characters), a description with the key hook in the first 2 lines, chapters if the source has timestamps, and 15 tags.',
  },
  {
    id: 'email',
    label: 'Email',
    guidance: '3 subject line options, a preview text, and the email body with a single clear CTA.',
  },
  {
    id: 'landing',
    label: 'Landing page copy',
    guidance: 'Hero headline and subhead, 3 benefit blocks, social proof section, FAQ (4 questions), and final CTA.',
  },
  {
    id: 'blog',
    label: 'Blog post / article',
    guidance: 'Headline, intro, H2 sections, and conclusion. Use facts from the sources and do not invent statistics.',
  },
  {
    id: 'press',
    label: 'Press release',
    guidance: 'Standard press release structure: headline, dateline, lead paragraph, quotes, boilerplate, media contact placeholder.',
  },
  { id: 'custom', label: 'Custom (describe in the brief)', guidance: '' },
];

export const formatById = (id: string) => FORMATS.find((f) => f.id === id) ?? FORMATS[FORMATS.length - 1];
