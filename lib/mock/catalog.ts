export const COUNTRIES: { code: string; name: string; cities: string[] }[] = [
  { code: 'DE', name: 'Germany', cities: ['Hamburg', 'Stuttgart', 'Cologne', 'Leipzig', 'Dresden', 'Hannover', 'Bremen', 'Mannheim', 'Karlsruhe', 'Augsburg', 'Mainz', 'Kiel', 'Freiburg', 'Erfurt', 'Kassel'] },
  { code: 'AT', name: 'Austria', cities: ['Linz', 'Graz', 'Salzburg', 'Innsbruck', 'Klagenfurt', 'Bregenz'] },
  { code: 'CH', name: 'Switzerland', cities: ['Zurich', 'Basel', 'Bern', 'Winterthur', 'St. Gallen'] },
  { code: 'IT', name: 'Italy', cities: ['Bologna', 'Bergamo', 'Brescia', 'Verona', 'Padova'] },
  { code: 'CZ', name: 'Czechia', cities: ['Brno', 'Ostrava', 'Plzen', 'Liberec'] },
  { code: 'PL', name: 'Poland', cities: ['Poznan', 'Wroclaw', 'Gdansk', 'Lodz'] },
  { code: 'CN', name: 'China', cities: ['Suzhou', 'Ningbo', 'Qingdao', 'Wuxi'] },
  { code: 'TW', name: 'Taiwan', cities: ['Taichung', 'Tainan', 'Hsinchu'] },
  { code: 'US', name: 'United States', cities: ['Milwaukee', 'Cleveland', 'Pittsburgh', 'Grand Rapids', 'Fort Wayne'] },
];

export const COUNTRY_PLAN = [
  ...Array.from({ length: 28 }, () => 'DE'),
  ...Array.from({ length: 6 }, () => 'AT'),
  ...Array.from({ length: 5 }, () => 'CH'),
  ...Array.from({ length: 5 }, () => 'IT'),
  ...Array.from({ length: 4 }, () => 'CZ'),
  ...Array.from({ length: 4 }, () => 'PL'),
  ...Array.from({ length: 4 }, () => 'CN'),
  ...Array.from({ length: 3 }, () => 'TW'),
  ...Array.from({ length: 5 }, () => 'US'),
];

export const NAME_A = ['Nord', 'Ost', 'Sued', 'West', 'Berg', 'Feld', 'Wald', 'Hafen', 'Bruck', 'Stein', 'Quell', 'Auen', 'Licht', 'Kern', 'Roth', 'Blau', 'Grau', 'Hoch', 'Klein', 'Lang', 'Neu', 'Alt', 'Frei', 'Hell', 'Moor', 'Sand', 'Kies', 'Erz', 'Holz', 'Glas', 'Fluss', 'Kap', 'Krone', 'Birke', 'Eiche', 'Tanne', 'Ulme', 'Weide', 'Kupfer', 'Silber', 'Amber', 'Linden', 'Buchen', 'Falken', 'Marder'];
export const NAME_B = ['werk', 'form', 'bau', 'guss', 'draht', 'rad', 'tech', 'line', 'pack', 'mesh', 'volt', 'therm', 'press', 'mont', 'lager', 'welle', 'modul', 'ring', 'stift', 'platte', 'kammer', 'hof', 'muehle'];
export const NAME_C = ['Metall', 'Antrieb', 'Kabel', 'Guss', 'Polymer', 'Fluid', 'Sensor', 'Pack', 'Modul', 'Werk'];

export const FIRST_NAMES = ['Mara', 'Levin', 'Anja', 'Piotr', 'Elena', 'Tomas', 'Klara', 'Henrik', 'Sofia', 'Jonas', 'Lina', 'Marek', 'Ingrid', 'Pavel', 'Nora', 'Felix', 'Ida', 'Ruth', 'Otto', 'Thea', 'Mats', 'Esme', 'Nils', 'Ada', 'Leo', 'Mila', 'Eva', 'Iris', 'Greta', 'Anton', 'Luisa', 'Emil', 'Frida', 'Oskar', 'Tilde', 'Bruno', 'Nelly', 'Soren', 'Asta', 'Viggo'];
export const LAST_NAMES = ['Keller', 'Holm', 'Vogel', 'Kranz', 'Sommer', 'Winter', 'Bach', 'Lang', 'Hartung', 'Neumann', 'Lorenz', 'Peters', 'Koenig', 'Berger', 'Fuchs', 'Weiss', 'Schwarz', 'Meier', 'Schulz', 'Wolf', 'Koch', 'Bauer', 'Richter', 'Zimmermann', 'Hofmann', 'Schaefer', 'Werner', 'Krueger', 'Brandt', 'Seidel'];

export const STREETS = ['Werkring', 'Hallenweg', 'Dockallee', 'Kesselplatz', 'Muehlenpfad', 'Spindelweg', 'Lagerhof', 'Bohrplatz'];

export const CONTACT_ROLES = ['Sales', 'Quality', 'Compliance', 'Account manager', 'Logistics'];

export const CATEGORIES = ['Cables', 'PCBs', 'Motors', 'Fasteners', 'Cooling', 'Enclosures', 'Connectors', 'Plastics', 'Castings', 'Sensors', 'Packaging', 'Logistics'];

export const CN_GROUPS = [
  { code: '8501', name: 'Electric motors and generators', category: 'Motors', unit: 'pcs' as const },
  { code: '8504', name: 'Electrical transformers', category: 'Motors', unit: 'pcs' as const },
  { code: '8544', name: 'Insulated wire and cable', category: 'Cables', unit: 'm' as const },
  { code: '8536', name: 'Switching apparatus', category: 'Connectors', unit: 'pcs' as const },
  { code: '7318', name: 'Screws, bolts and nuts', category: 'Fasteners', unit: 'pcs' as const },
  { code: '8534', name: 'Printed circuits', category: 'PCBs', unit: 'pcs' as const },
  { code: '8483', name: 'Gears and transmission parts', category: 'Motors', unit: 'pcs' as const },
  { code: '8413', name: 'Pumps for liquids', category: 'Cooling', unit: 'pcs' as const },
  { code: '8481', name: 'Taps, cocks and valves', category: 'Cooling', unit: 'pcs' as const },
  { code: '7326', name: 'Articles of iron or steel', category: 'Castings', unit: 'kg' as const },
  { code: '3926', name: 'Plastic parts', category: 'Plastics', unit: 'pcs' as const },
  { code: '7606', name: 'Aluminium plate and sheet', category: 'Enclosures', unit: 'kg' as const },
];

export const PART_NOUNS: Record<string, string[]> = {
  '8501': ['Servo motor', 'Gear motor', 'Fan motor'],
  '8504': ['Control transformer', 'Power choke', 'Isolation transformer'],
  '8544': ['Control cable', 'Motor lead', 'Data cable'],
  '8536': ['Relay', 'Terminal block', 'Limit switch'],
  '7318': ['Hex bolt', 'Flange nut', 'Thread insert'],
  '8534': ['Control board', 'Sensor board', 'Power board'],
  '8483': ['Timing pulley', 'Coupling', 'Linear shaft'],
  '8413': ['Coolant pump', 'Gear pump', 'Dosing pump'],
  '8481': ['Ball valve', 'Needle valve', 'Check valve'],
  '7326': ['Mounting bracket', 'Steel spacer', 'Cover plate'],
  '3926': ['Cable gland', 'End cap', 'Spacer ring'],
  '7606': ['Aluminium panel', 'Cover sheet', 'Heat spreader'],
};

export function countryName(code: string): string {
  return COUNTRIES.find((country) => country.code === code)?.name ?? code;
}

export function suffixFor(code: string, rng: () => number): string {
  const table: Record<string, string[]> = {
    DE: ['GmbH', 'AG', 'KG', 'GmbH & Co. KG'],
    AT: ['GmbH', 'AG'],
    CH: ['AG', 'GmbH'],
    IT: ['S.p.A.', 'S.r.l.'],
    CZ: ['s.r.o.', 'a.s.'],
    PL: ['Sp. z o.o.'],
    CN: ['Co.', 'Ltd'],
    TW: ['Co.', 'Ltd'],
    US: ['Inc.', 'LLC', 'Co.'],
  };
  const options = table[code] ?? ['Ltd'];
  return options[Math.floor(rng() * options.length)] ?? 'Ltd';
}
