import { IdType } from '../types/platform';

export interface CountryDocumentRule {
  localLabel: string;
  placeholder: string;
  formatHint: string;
  pattern: string;
  requiresBackImage: boolean;
}

export interface GlobalKycCountry {
  code: string;
  name: string;
  flag: string;
  region: 'Asia' | 'Europe' | 'Middle East' | 'North America' | 'South America' | 'Africa' | 'Oceania';
  nationality: string;
  documentRules: Record<IdType, CountryDocumentRule>;
}

/** Converts an ISO 3166-1 alpha-2 country code (e.g. "BD", "US") to its regional indicator flag emoji. */
export function isoToFlagEmoji(code: string): string {
  const clean = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  return String.fromCodePoint(
    0x1f1e6 + clean.charCodeAt(0) - 65,
    0x1f1e6 + clean.charCodeAt(1) - 65
  );
}

const DEFAULT_DOC_RULES: Record<IdType, CountryDocumentRule> = {
  NID: {
    localLabel: 'National Identity Card (NID)',
    placeholder: 'e.g. 1234567890',
    formatHint: '6–20 alphanumeric characters',
    pattern: '^[A-Za-z0-9\\-\\s]{5,24}$',
    requiresBackImage: true,
  },
  Passport: {
    localLabel: 'International Passport',
    placeholder: 'e.g. A12345678',
    formatHint: '6–12 alphanumeric passport number',
    pattern: '^[A-Za-z0-9]{6,14}$',
    requiresBackImage: false,
  },
  'Driving License': {
    localLabel: 'Driving License',
    placeholder: 'e.g. DL-90812345',
    formatHint: '5–20 alphanumeric characters',
    pattern: '^[A-Za-z0-9\\-\\s]{5,24}$',
    requiresBackImage: true,
  },
};

const COUNTRY_RULE_OVERRIDES: Record<string, Partial<Record<IdType, Partial<CountryDocumentRule>>>> = {
  BD: {
    NID: {
      localLabel: 'Bangladesh National ID / Smart Card (NID)',
      placeholder: '10, 13, or 17 digit NID number',
      formatHint: '10-digit Smart NID or 13/17-digit Legacy NID',
      pattern: '^([0-9]{10}|[0-9]{13}|[0-9]{17})$',
      requiresBackImage: true,
    },
    Passport: {
      localLabel: 'Bangladesh e-Passport / MRP',
      placeholder: 'e.g. A01234567 or EK0123456',
      formatHint: '1–2 letters followed by 7–8 digits',
      pattern: '^[A-Za-z]{1,2}[0-9]{7,8}$',
      requiresBackImage: false,
    },
    'Driving License': {
      localLabel: 'BRTA Smart Driving License',
      placeholder: 'e.g. DK0123456CL0001',
      formatHint: '12–16 alphanumeric BRTA license code',
      pattern: '^[A-Za-z0-9\\-]{8,20}$',
      requiresBackImage: true,
    },
  },
  IN: {
    NID: {
      localLabel: 'Aadhaar Card / PAN Card',
      placeholder: '12-digit Aadhaar or 10-char PAN',
      formatHint: '12 digits (Aadhaar) or ABCDE1234F (PAN)',
      pattern: '^([0-9]{12}|[A-Za-z]{5}[0-9]{4}[A-Za-z])$',
      requiresBackImage: true,
    },
    Passport: {
      localLabel: 'Indian Passport',
      placeholder: 'e.g. Z1234567',
      formatHint: '1 letter followed by 7 digits',
      pattern: '^[A-Za-z][0-9]{7}$',
      requiresBackImage: false,
    },
  },
  PK: {
    NID: {
      localLabel: 'NADRA CNIC / NICOP',
      placeholder: 'e.g. 35202-1234567-1',
      formatHint: '13 digits (XXXXX-XXXXXXX-X)',
      pattern: '^[0-9]{5}-?[0-9]{7}-?[0-9]$',
      requiresBackImage: true,
    },
  },
  AE: {
    NID: {
      localLabel: 'Emirates ID',
      placeholder: 'e.g. 784-1990-1234567-1',
      formatHint: '15 digits starting with 784',
      pattern: '^784-?[0-9]{4}-?[0-9]{7}-?[0-9]$',
      requiresBackImage: true,
    },
  },
  SA: {
    NID: {
      localLabel: 'Saudi National ID / Iqama',
      placeholder: 'e.g. 1023456789 or 2345678901',
      formatHint: '10 digits starting with 1 (Citizen) or 2 (Iqama)',
      pattern: '^[12][0-9]{9}$',
      requiresBackImage: true,
    },
  },
  US: {
    NID: {
      localLabel: 'State-Issued ID / REAL ID Card',
      placeholder: 'e.g. D123-4567-8901',
      formatHint: '6–16 alphanumeric state ID number',
      pattern: '^[A-Za-z0-9\\-]{6,18}$',
      requiresBackImage: true,
    },
    Passport: {
      localLabel: 'U.S. Passport Book / Card',
      placeholder: 'e.g. 542189012 or A12345678',
      formatHint: '9 alphanumeric characters',
      pattern: '^[A-Za-z0-9]{9}$',
      requiresBackImage: false,
    },
    'Driving License': {
      localLabel: 'U.S. State Driver License',
      placeholder: 'e.g. S12345678',
      formatHint: '5–16 alphanumeric characters',
      pattern: '^[A-Za-z0-9\\-]{5,18}$',
      requiresBackImage: true,
    },
  },
  GB: {
    NID: {
      localLabel: 'UK Biometric Residence Permit / CitizenCard',
      placeholder: 'e.g. RZ1234567',
      formatHint: '8–12 alphanumeric characters',
      pattern: '^[A-Za-z0-9]{6,14}$',
      requiresBackImage: true,
    },
    Passport: {
      localLabel: 'British Passport',
      placeholder: 'e.g. 532198421',
      formatHint: '9 numeric digits',
      pattern: '^[0-9]{9}$',
      requiresBackImage: false,
    },
    'Driving License': {
      localLabel: 'UK DVLA Photocard Driving Licence',
      placeholder: 'e.g. SMITH901234AB9CD',
      formatHint: '16-character DVLA driver number',
      pattern: '^[A-Za-z0-9]{14,18}$',
      requiresBackImage: true,
    },
  },
  CA: {
    NID: {
      localLabel: 'Provincial Photo ID / PR Card',
      placeholder: 'e.g. 1234-5678-9012',
      formatHint: '8–16 alphanumeric characters',
      pattern: '^[A-Za-z0-9\\-]{6,18}$',
      requiresBackImage: true,
    },
    Passport: {
      localLabel: 'Canadian Passport',
      placeholder: 'e.g. AB123456',
      formatHint: '2 letters followed by 6 digits',
      pattern: '^[A-Za-z]{2}[0-9]{6}$',
      requiresBackImage: false,
    },
  },
  MY: {
    NID: {
      localLabel: 'MyKad / MyPR',
      placeholder: 'e.g. 920514-14-5678',
      formatHint: '12 digits (YYMMDD-PB-###G)',
      pattern: '^[0-9]{6}-?[0-9]{2}-?[0-9]{4}$',
      requiresBackImage: true,
    },
  },
  SG: {
    NID: {
      localLabel: 'Singapore NRIC / FIN',
      placeholder: 'e.g. S9123456A',
      formatHint: 'Starts with S/T/F/G/M + 7 digits + checksum letter',
      pattern: '^[STFGMstfgm][0-9]{7}[A-Za-z]$',
      requiresBackImage: true,
    },
  },
  NG: {
    NID: {
      localLabel: 'National Identification Number (NIN)',
      placeholder: 'e.g. 12345678901',
      formatHint: '11-digit NIN',
      pattern: '^[0-9]{11}$',
      requiresBackImage: true,
    },
  },
  ID: {
    NID: {
      localLabel: 'KTP (Kartu Tanda Penduduk)',
      placeholder: 'e.g. 3171021405920001',
      formatHint: '16-digit NIK',
      pattern: '^[0-9]{16}$',
      requiresBackImage: true,
    },
  },
  TR: {
    NID: {
      localLabel: 'T.C. Kimlik Kartı',
      placeholder: 'e.g. 12345678901',
      formatHint: '11-digit Turkish Identity Number',
      pattern: '^[1-9][0-9]{10}$',
      requiresBackImage: true,
    },
  },
  DE: {
    NID: {
      localLabel: 'Personalausweis (German National ID)',
      placeholder: 'e.g. T22000129',
      formatHint: '9 alphanumeric characters',
      pattern: '^[A-Za-z0-9]{9,10}$',
      requiresBackImage: true,
    },
  },
  BR: {
    NID: {
      localLabel: 'RG / CPF Identity Card',
      placeholder: 'e.g. 123.456.789-01',
      formatHint: '11-digit CPF or 9-digit RG',
      pattern: '^[0-9.\\-]{9,14}$',
      requiresBackImage: true,
    },
  },
};

type RawCountryTuple = [
  string,
  string,
  GlobalKycCountry['region'],
  string,
];

const RAW_WORLD_COUNTRIES: RawCountryTuple[] = [
  ['AF', 'Afghanistan', 'Asia', 'Afghan'],
  ['AL', 'Albania', 'Europe', 'Albanian'],
  ['DZ', 'Algeria', 'Africa', 'Algerian'],
  ['AD', 'Andorra', 'Europe', 'Andorran'],
  ['AO', 'Angola', 'Africa', 'Angolan'],
  ['AG', 'Antigua and Barbuda', 'North America', 'Antiguan'],
  ['AR', 'Argentina', 'South America', 'Argentine'],
  ['AM', 'Armenia', 'Asia', 'Armenian'],
  ['AU', 'Australia', 'Oceania', 'Australian'],
  ['AT', 'Austria', 'Europe', 'Austrian'],
  ['AZ', 'Azerbaijan', 'Asia', 'Azerbaijani'],
  ['BS', 'Bahamas', 'North America', 'Bahamian'],
  ['BH', 'Bahrain', 'Middle East', 'Bahraini'],
  ['BD', 'Bangladesh', 'Asia', 'Bangladeshi'],
  ['BB', 'Barbados', 'North America', 'Barbadian'],
  ['BY', 'Belarus', 'Europe', 'Belarusian'],
  ['BE', 'Belgium', 'Europe', 'Belgian'],
  ['BZ', 'Belize', 'North America', 'Belizean'],
  ['BJ', 'Benin', 'Africa', 'Beninese'],
  ['BT', 'Bhutan', 'Asia', 'Bhutanese'],
  ['BO', 'Bolivia', 'South America', 'Bolivian'],
  ['BA', 'Bosnia and Herzegovina', 'Europe', 'Bosnian'],
  ['BW', 'Botswana', 'Africa', 'Motswana'],
  ['BR', 'Brazil', 'South America', 'Brazilian'],
  ['BN', 'Brunei', 'Asia', 'Bruneian'],
  ['BG', 'Bulgaria', 'Europe', 'Bulgarian'],
  ['BF', 'Burkina Faso', 'Africa', 'Burkinabe'],
  ['BI', 'Burundi', 'Africa', 'Burundian'],
  ['CV', 'Cabo Verde', 'Africa', 'Cabo Verdean'],
  ['KH', 'Cambodia', 'Asia', 'Cambodian'],
  ['CM', 'Cameroon', 'Africa', 'Cameroonian'],
  ['CA', 'Canada', 'North America', 'Canadian'],
  ['CF', 'Central African Republic', 'Africa', 'Central African'],
  ['TD', 'Chad', 'Africa', 'Chadian'],
  ['CL', 'Chile', 'South America', 'Chilean'],
  ['CN', 'China', 'Asia', 'Chinese'],
  ['CO', 'Colombia', 'South America', 'Colombian'],
  ['KM', 'Comoros', 'Africa', 'Comorian'],
  ['CG', 'Congo', 'Africa', 'Congolese'],
  ['CD', 'Congo (DRC)', 'Africa', 'Congolese'],
  ['CR', 'Costa Rica', 'North America', 'Costa Rican'],
  ['CI', "Côte d'Ivoire", 'Africa', 'Ivorian'],
  ['HR', 'Croatia', 'Europe', 'Croatian'],
  ['CU', 'Cuba', 'North America', 'Cuban'],
  ['CY', 'Cyprus', 'Europe', 'Cypriot'],
  ['CZ', 'Czechia', 'Europe', 'Czech'],
  ['DK', 'Denmark', 'Europe', 'Danish'],
  ['DJ', 'Djibouti', 'Africa', 'Djiboutian'],
  ['DM', 'Dominica', 'North America', 'Dominican'],
  ['DO', 'Dominican Republic', 'North America', 'Dominican'],
  ['EC', 'Ecuador', 'South America', 'Ecuadorian'],
  ['EG', 'Egypt', 'Middle East', 'Egyptian'],
  ['SV', 'El Salvador', 'North America', 'Salvadoran'],
  ['GQ', 'Equatorial Guinea', 'Africa', 'Equatoguinean'],
  ['ER', 'Eritrea', 'Africa', 'Eritrean'],
  ['EE', 'Estonia', 'Europe', 'Estonian'],
  ['SZ', 'Eswatini', 'Africa', 'Swazi'],
  ['ET', 'Ethiopia', 'Africa', 'Ethiopian'],
  ['FJ', 'Fiji', 'Oceania', 'Fijian'],
  ['FI', 'Finland', 'Europe', 'Finnish'],
  ['FR', 'France', 'Europe', 'French'],
  ['GA', 'Gabon', 'Africa', 'Gabonese'],
  ['GM', 'Gambia', 'Africa', 'Gambian'],
  ['GE', 'Georgia', 'Asia', 'Georgian'],
  ['DE', 'Germany', 'Europe', 'German'],
  ['GH', 'Ghana', 'Africa', 'Ghanaian'],
  ['GR', 'Greece', 'Europe', 'Greek'],
  ['GD', 'Grenada', 'North America', 'Grenadian'],
  ['GT', 'Guatemala', 'North America', 'Guatemalan'],
  ['GN', 'Guinea', 'Africa', 'Guinean'],
  ['GW', 'Guinea-Bissau', 'Africa', 'Bissau-Guinean'],
  ['GY', 'Guyana', 'South America', 'Guyanese'],
  ['HT', 'Haiti', 'North America', 'Haitian'],
  ['HN', 'Honduras', 'North America', 'Honduran'],
  ['HK', 'Hong Kong', 'Asia', 'Hong Kong'],
  ['HU', 'Hungary', 'Europe', 'Hungarian'],
  ['IS', 'Iceland', 'Europe', 'Icelandic'],
  ['IN', 'India', 'Asia', 'Indian'],
  ['ID', 'Indonesia', 'Asia', 'Indonesian'],
  ['IR', 'Iran', 'Middle East', 'Iranian'],
  ['IQ', 'Iraq', 'Middle East', 'Iraqi'],
  ['IE', 'Ireland', 'Europe', 'Irish'],
  ['IL', 'Israel', 'Middle East', 'Israeli'],
  ['IT', 'Italy', 'Europe', 'Italian'],
  ['JM', 'Jamaica', 'North America', 'Jamaican'],
  ['JP', 'Japan', 'Asia', 'Japanese'],
  ['JO', 'Jordan', 'Middle East', 'Jordanian'],
  ['KZ', 'Kazakhstan', 'Asia', 'Kazakhstani'],
  ['KE', 'Kenya', 'Africa', 'Kenyan'],
  ['KI', 'Kiribati', 'Oceania', 'I-Kiribati'],
  ['KP', 'North Korea', 'Asia', 'North Korean'],
  ['KR', 'South Korea', 'Asia', 'South Korean'],
  ['KW', 'Kuwait', 'Middle East', 'Kuwaiti'],
  ['KG', 'Kyrgyzstan', 'Asia', 'Kyrgyz'],
  ['LA', 'Laos', 'Asia', 'Lao'],
  ['LV', 'Latvia', 'Europe', 'Latvian'],
  ['LB', 'Lebanon', 'Middle East', 'Lebanese'],
  ['LS', 'Lesotho', 'Africa', 'Basotho'],
  ['LR', 'Liberia', 'Africa', 'Liberian'],
  ['LY', 'Libya', 'Africa', 'Libyan'],
  ['LI', 'Liechtenstein', 'Europe', 'Liechtensteiner'],
  ['LT', 'Lithuania', 'Europe', 'Lithuanian'],
  ['LU', 'Luxembourg', 'Europe', 'Luxembourgish'],
  ['MO', 'Macau', 'Asia', 'Macanese'],
  ['MG', 'Madagascar', 'Africa', 'Malagasy'],
  ['MW', 'Malawi', 'Africa', 'Malawian'],
  ['MY', 'Malaysia', 'Asia', 'Malaysian'],
  ['MV', 'Maldives', 'Asia', 'Maldivian'],
  ['ML', 'Mali', 'Africa', 'Malian'],
  ['MT', 'Malta', 'Europe', 'Maltese'],
  ['MH', 'Marshall Islands', 'Oceania', 'Marshallese'],
  ['MR', 'Mauritania', 'Africa', 'Mauritanian'],
  ['MU', 'Mauritius', 'Africa', 'Mauritian'],
  ['MX', 'Mexico', 'North America', 'Mexican'],
  ['FM', 'Micronesia', 'Oceania', 'Micronesian'],
  ['MD', 'Moldova', 'Europe', 'Moldovan'],
  ['MC', 'Monaco', 'Europe', 'Monegasque'],
  ['MN', 'Mongolia', 'Asia', 'Mongolian'],
  ['ME', 'Montenegro', 'Europe', 'Montenegrin'],
  ['MA', 'Morocco', 'Africa', 'Moroccan'],
  ['MZ', 'Mozambique', 'Africa', 'Mozambican'],
  ['MM', 'Myanmar', 'Asia', 'Burmese'],
  ['NA', 'Namibia', 'Africa', 'Namibian'],
  ['NR', 'Nauru', 'Oceania', 'Nauruan'],
  ['NP', 'Nepal', 'Asia', 'Nepalese'],
  ['NL', 'Netherlands', 'Europe', 'Dutch'],
  ['NZ', 'New Zealand', 'Oceania', 'New Zealander'],
  ['NI', 'Nicaragua', 'North America', 'Nicaraguan'],
  ['NE', 'Niger', 'Africa', 'Nigerien'],
  ['NG', 'Nigeria', 'Africa', 'Nigerian'],
  ['MK', 'North Macedonia', 'Europe', 'Macedonian'],
  ['NO', 'Norway', 'Europe', 'Norwegian'],
  ['OM', 'Oman', 'Middle East', 'Omani'],
  ['PK', 'Pakistan', 'Asia', 'Pakistani'],
  ['PW', 'Palau', 'Oceania', 'Palauan'],
  ['PS', 'Palestine', 'Middle East', 'Palestinian'],
  ['PA', 'Panama', 'North America', 'Panamanian'],
  ['PG', 'Papua New Guinea', 'Oceania', 'Papua New Guinean'],
  ['PY', 'Paraguay', 'South America', 'Paraguayan'],
  ['PE', 'Peru', 'South America', 'Peruvian'],
  ['PH', 'Philippines', 'Asia', 'Filipino'],
  ['PL', 'Poland', 'Europe', 'Polish'],
  ['PT', 'Portugal', 'Europe', 'Portuguese'],
  ['PR', 'Puerto Rico', 'North America', 'Puerto Rican'],
  ['QA', 'Qatar', 'Middle East', 'Qatari'],
  ['RO', 'Romania', 'Europe', 'Romanian'],
  ['RU', 'Russia', 'Europe', 'Russian'],
  ['RW', 'Rwanda', 'Africa', 'Rwandan'],
  ['KN', 'Saint Kitts and Nevis', 'North America', 'Kittitian'],
  ['LC', 'Saint Lucia', 'North America', 'Saint Lucian'],
  ['VC', 'Saint Vincent and the Grenadines', 'North America', 'Vincentian'],
  ['WS', 'Samoa', 'Oceania', 'Samoan'],
  ['SM', 'San Marino', 'Europe', 'Sammarinese'],
  ['ST', 'Sao Tome and Principe', 'Africa', 'Sao Tomean'],
  ['SA', 'Saudi Arabia', 'Middle East', 'Saudi'],
  ['SN', 'Senegal', 'Africa', 'Senegalese'],
  ['RS', 'Serbia', 'Europe', 'Serbian'],
  ['SC', 'Seychelles', 'Africa', 'Seychellois'],
  ['SL', 'Sierra Leone', 'Africa', 'Sierra Leonean'],
  ['SG', 'Singapore', 'Asia', 'Singaporean'],
  ['SK', 'Slovakia', 'Europe', 'Slovak'],
  ['SI', 'Slovenia', 'Europe', 'Slovenian'],
  ['SB', 'Solomon Islands', 'Oceania', 'Solomon Islander'],
  ['SO', 'Somalia', 'Africa', 'Somali'],
  ['ZA', 'South Africa', 'Africa', 'South African'],
  ['SS', 'South Sudan', 'Africa', 'South Sudanese'],
  ['ES', 'Spain', 'Europe', 'Spanish'],
  ['LK', 'Sri Lanka', 'Asia', 'Sri Lankan'],
  ['SD', 'Sudan', 'Africa', 'Sudanese'],
  ['SR', 'Suriname', 'South America', 'Surinamese'],
  ['SE', 'Sweden', 'Europe', 'Swedish'],
  ['CH', 'Switzerland', 'Europe', 'Swiss'],
  ['SY', 'Syria', 'Middle East', 'Syrian'],
  ['TW', 'Taiwan', 'Asia', 'Taiwanese'],
  ['TJ', 'Tajikistan', 'Asia', 'Tajik'],
  ['TZ', 'Tanzania', 'Africa', 'Tanzanian'],
  ['TH', 'Thailand', 'Asia', 'Thai'],
  ['TL', 'Timor-Leste', 'Asia', 'Timorese'],
  ['TG', 'Togo', 'Africa', 'Togolese'],
  ['TO', 'Tonga', 'Oceania', 'Tongan'],
  ['TT', 'Trinidad and Tobago', 'North America', 'Trinidadian'],
  ['TN', 'Tunisia', 'Africa', 'Tunisian'],
  ['TR', 'Turkey', 'Middle East', 'Turkish'],
  ['TM', 'Turkmenistan', 'Asia', 'Turkmen'],
  ['TV', 'Tuvalu', 'Oceania', 'Tuvaluan'],
  ['UG', 'Uganda', 'Africa', 'Ugandan'],
  ['UA', 'Ukraine', 'Europe', 'Ukrainian'],
  ['AE', 'United Arab Emirates', 'Middle East', 'Emirati'],
  ['GB', 'United Kingdom', 'Europe', 'British'],
  ['US', 'United States', 'North America', 'American'],
  ['UY', 'Uruguay', 'South America', 'Uruguayan'],
  ['UZ', 'Uzbekistan', 'Asia', 'Uzbek'],
  ['VU', 'Vanuatu', 'Oceania', 'Ni-Vanuatu'],
  ['VA', 'Vatican City', 'Europe', 'Vatican'],
  ['VE', 'Venezuela', 'South America', 'Venezuelan'],
  ['VN', 'Vietnam', 'Asia', 'Vietnamese'],
  ['YE', 'Yemen', 'Middle East', 'Yemeni'],
  ['ZM', 'Zambia', 'Africa', 'Zambian'],
  ['ZW', 'Zimbabwe', 'Africa', 'Zimbabwean'],
];

export const GLOBAL_KYC_COUNTRIES: GlobalKycCountry[] = RAW_WORLD_COUNTRIES.map(
  ([code, name, region, nationality]) => {
    const overrides = COUNTRY_RULE_OVERRIDES[code] || {};
    return {
      code,
      name,
      flag: isoToFlagEmoji(code),
      region,
      nationality,
      documentRules: {
        NID: { ...DEFAULT_DOC_RULES.NID, ...(overrides.NID || {}) },
        Passport: { ...DEFAULT_DOC_RULES.Passport, ...(overrides.Passport || {}) },
        'Driving License': {
          ...DEFAULT_DOC_RULES['Driving License'],
          ...(overrides['Driving License'] || {}),
        },
      },
    };
  }
);

export function getGlobalKycCountry(code?: string): GlobalKycCountry {
  const target = (code || 'BD').trim().toUpperCase();
  return (
    GLOBAL_KYC_COUNTRIES.find((c) => c.code === target) ||
    GLOBAL_KYC_COUNTRIES.find((c) => c.code === 'BD') ||
    GLOBAL_KYC_COUNTRIES[0]
  );
}

export function validateKycDocumentNumber(
  country: GlobalKycCountry,
  idType: IdType,
  rawNumber: string
): { valid: boolean; normalized: string; message: string } {
  const normalized = rawNumber.trim().toUpperCase();
  const rule = country.documentRules[idType];
  if (!normalized) {
    return {
      valid: false,
      normalized: '',
      message: `Enter your ${rule.localLabel} number (${rule.formatHint}).`,
    };
  }
  const re = new RegExp(rule.pattern);
  if (!re.test(normalized)) {
    return {
      valid: false,
      normalized,
      message: `Format hint for ${country.name} ${rule.localLabel}: ${rule.formatHint}.`,
    };
  }
  return {
    valid: true,
    normalized,
    message: `Valid ${country.name} ${rule.localLabel} format.`,
  };
}
