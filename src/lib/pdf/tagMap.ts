import type { SpecialisedRole } from '../types';

export interface TagInfo {
  label?: string;
  specialised?: SpecialisedRole;
  ignore?: boolean;
}

const TAG_MAP: Record<string, TagInfo> = {
  'BB': { ignore: true },
  'B': { ignore: true },
  'C&H Salesfloor': { label: 'C&H Salesfloor' },
  'C&H Salesfloor BE': { label: 'C&H Salesfloor BE' },
  'C&H Tilling': { label: 'C&H Tilling' },
  'C&H Tilling 5': { label: 'C&H Tilling 5' },
  'C&H Fill': { label: 'C&H Fill' },
  'C&H Adhoc': { label: 'C&H Adhoc' },
  'Bank Services': { label: 'Bank Services' },
  'Beauty': { label: 'Beauty' },
  'Bra Fit': { specialised: 'lingerie', label: 'Bra Fit' },
  'Bureau': { specialised: 'bureau', label: 'Bureau' },
  'VM': { specialised: 'vm', label: 'VM' },
  'ISF': { specialised: 'isf', label: 'ISF' },
  'Stock Controller (A&A)': { specialised: 'isf', label: 'Stock Controller' },
  'Stock Co...': { specialised: 'isf', label: 'Stock Controller' },
  'Stock Co': { specialised: 'isf', label: 'Stock Controller' },
  'TSM': { specialised: 'tsm', label: 'TSM' },
  'Team Support Manager': { specialised: 'tsm', label: 'TSM' },
};

// Longest-first so "Bank Services" wins over "B" when the cell text is "B".
const PREFIX_KEYS = Object.keys(TAG_MAP).sort((a, b) => b.length - a.length);

export function lookupTag(raw: string): TagInfo | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (TAG_MAP[trimmed]) return TAG_MAP[trimmed];
  for (const key of PREFIX_KEYS) {
    if (trimmed.startsWith(key)) return TAG_MAP[key];
  }
  return undefined;
}
