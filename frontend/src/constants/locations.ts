export interface StaticLocation {
  name: string;
  slug: string;
}

export const LOCATIONS: StaticLocation[] = [
  { name: 'Aviemore', slug: 'aviemore' },
  { name: 'Dingwall', slug: 'dingwall' },
  { name: 'Fort William', slug: 'fort-william' },
  { name: 'Inverness', slug: 'inverness' },
  { name: 'Nairn', slug: 'nairn' },
  { name: 'Thurso', slug: 'thurso' },
  { name: 'Ullapool', slug: 'ullapool' },
  { name: 'Wick', slug: 'wick' }
];
