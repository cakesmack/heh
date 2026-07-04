export interface StaticLocation {
  name: string;
  slug: string;
}

export const CORE_LOCATIONS: StaticLocation[] = [
  { name: 'Inverness', slug: 'inverness' },
  { name: 'Aviemore', slug: 'aviemore' },
  { name: 'Fort William', slug: 'fort-william' },
  { name: 'Oban', slug: 'oban' },
  { name: 'Elgin', slug: 'elgin' },
  { name: 'Nairn', slug: 'nairn' },
  { name: 'Thurso', slug: 'thurso' },
  { name: 'Portree', slug: 'portree' }
];

export const LOCATIONS: StaticLocation[] = [
  ...CORE_LOCATIONS,
  { name: 'Dingwall', slug: 'dingwall' },
  { name: 'Ullapool', slug: 'ullapool' },
  { name: 'Wick', slug: 'wick' }
];
