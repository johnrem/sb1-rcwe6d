export interface FormatPreset {
  id: string;
  label: string;
  guidance: string;
}

export const FORMATS: FormatPreset[] = [
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
