export interface CountryPhoneOption {
  code: string;
  name: string;
  flag: string;
  /** Dial code including fixed mobile starting digit where standard (e.g. +8801 for Bangladesh). */
  dialPrefix: string;
  minRemainingDigits: number;
  maxRemainingDigits: number;
  placeholder: string;
}

export const COUNTRY_PHONE_OPTIONS: CountryPhoneOption[] = [
  {
    code: 'BD',
    name: 'Bangladesh',
    flag: '🇧🇩',
    dialPrefix: '+8801',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '712345678',
  },
  {
    code: 'IN',
    name: 'India',
    flag: '🇮🇳',
    dialPrefix: '+91',
    minRemainingDigits: 10,
    maxRemainingDigits: 10,
    placeholder: '9876543210',
  },
  {
    code: 'PK',
    name: 'Pakistan',
    flag: '🇵🇰',
    dialPrefix: '+923',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '001234567',
  },
  {
    code: 'AE',
    name: 'United Arab Emirates',
    flag: '🇦🇪',
    dialPrefix: '+9715',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '01234567',
  },
  {
    code: 'SA',
    name: 'Saudi Arabia',
    flag: '🇸🇦',
    dialPrefix: '+9665',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '01234567',
  },
  {
    code: 'MY',
    name: 'Malaysia',
    flag: '🇲🇾',
    dialPrefix: '+601',
    minRemainingDigits: 8,
    maxRemainingDigits: 9,
    placeholder: '23456789',
  },
  {
    code: 'SG',
    name: 'Singapore',
    flag: '🇸🇬',
    dialPrefix: '+65',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '81234567',
  },
  {
    code: 'US',
    name: 'United States',
    flag: '🇺🇸',
    dialPrefix: '+1',
    minRemainingDigits: 10,
    maxRemainingDigits: 10,
    placeholder: '4155550132',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    flag: '🇬🇧',
    dialPrefix: '+447',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '700900123',
  },
  {
    code: 'CA',
    name: 'Canada',
    flag: '🇨🇦',
    dialPrefix: '+1',
    minRemainingDigits: 10,
    maxRemainingDigits: 10,
    placeholder: '4165550199',
  },
  {
    code: 'AU',
    name: 'Australia',
    flag: '🇦🇺',
    dialPrefix: '+614',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '12345678',
  },
  {
    code: 'ID',
    name: 'Indonesia',
    flag: '🇮🇩',
    dialPrefix: '+628',
    minRemainingDigits: 8,
    maxRemainingDigits: 11,
    placeholder: '1234567890',
  },
  {
    code: 'PH',
    name: 'Philippines',
    flag: '🇵🇭',
    dialPrefix: '+639',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '171234567',
  },
  {
    code: 'QA',
    name: 'Qatar',
    flag: '🇶🇦',
    dialPrefix: '+974',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '33123456',
  },
  {
    code: 'KW',
    name: 'Kuwait',
    flag: '🇰🇼',
    dialPrefix: '+965',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '50123456',
  },
  {
    code: 'OM',
    name: 'Oman',
    flag: '🇴🇲',
    dialPrefix: '+968',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '91234567',
  },
  {
    code: 'BH',
    name: 'Bahrain',
    flag: '🇧🇭',
    dialPrefix: '+973',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '36123456',
  },
  {
    code: 'TR',
    name: 'Turkey',
    flag: '🇹🇷',
    dialPrefix: '+905',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '321234567',
  },
  {
    code: 'DE',
    name: 'Germany',
    flag: '🇩🇪',
    dialPrefix: '+491',
    minRemainingDigits: 9,
    maxRemainingDigits: 10,
    placeholder: '5112345678',
  },
  {
    code: 'FR',
    name: 'France',
    flag: '🇫🇷',
    dialPrefix: '+336',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '12345678',
  },
  {
    code: 'IT',
    name: 'Italy',
    flag: '🇮🇹',
    dialPrefix: '+393',
    minRemainingDigits: 8,
    maxRemainingDigits: 9,
    placeholder: '201234567',
  },
  {
    code: 'ES',
    name: 'Spain',
    flag: '🇪🇸',
    dialPrefix: '+346',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '12345678',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    flag: '🇳🇱',
    dialPrefix: '+316',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '12345678',
  },
  {
    code: 'NG',
    name: 'Nigeria',
    flag: '🇳🇬',
    dialPrefix: '+234',
    minRemainingDigits: 10,
    maxRemainingDigits: 10,
    placeholder: '8012345678',
  },
  {
    code: 'EG',
    name: 'Egypt',
    flag: '🇪🇬',
    dialPrefix: '+201',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '001234567',
  },
  {
    code: 'ZA',
    name: 'South Africa',
    flag: '🇿🇦',
    dialPrefix: '+27',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '821234567',
  },
  {
    code: 'NP',
    name: 'Nepal',
    flag: '🇳🇵',
    dialPrefix: '+9779',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '801234567',
  },
  {
    code: 'LK',
    name: 'Sri Lanka',
    flag: '🇱🇰',
    dialPrefix: '+947',
    minRemainingDigits: 8,
    maxRemainingDigits: 8,
    placeholder: '71234567',
  },
  {
    code: 'TH',
    name: 'Thailand',
    flag: '🇹🇭',
    dialPrefix: '+66',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '812345678',
  },
  {
    code: 'VN',
    name: 'Vietnam',
    flag: '🇻🇳',
    dialPrefix: '+84',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '912345678',
  },
  {
    code: 'JP',
    name: 'Japan',
    flag: '🇯🇵',
    dialPrefix: '+81',
    minRemainingDigits: 10,
    maxRemainingDigits: 10,
    placeholder: '9012345678',
  },
  {
    code: 'KR',
    name: 'South Korea',
    flag: '🇰🇷',
    dialPrefix: '+821',
    minRemainingDigits: 9,
    maxRemainingDigits: 9,
    placeholder: '012345678',
  },
  {
    code: 'BR',
    name: 'Brazil',
    flag: '🇧🇷',
    dialPrefix: '+55',
    minRemainingDigits: 10,
    maxRemainingDigits: 11,
    placeholder: '11987654321',
  },
];

export function getCountryByCode(code?: string): CountryPhoneOption {
  return (
    COUNTRY_PHONE_OPTIONS.find((c) => c.code === code) || COUNTRY_PHONE_OPTIONS[0]
  );
}

/**
 * Normalizes user-entered or pasted digits relative to the country's dialPrefix
 * (e.g. for Bangladesh +8801, strips pasted +8801 / 8801 / 01 so remaining digits are 9 digits).
 */
export function normalizeRemainingPhoneDigits(
  country: CountryPhoneOption,
  rawInput: string
): string {
  let digits = rawInput.replace(/\D/g, '');
  const prefixDigits = country.dialPrefix.replace(/\D/g, '');

  if (digits.startsWith(prefixDigits) && digits.length > country.maxRemainingDigits) {
    digits = digits.slice(prefixDigits.length);
  } else if (
    country.code === 'BD' &&
    digits.startsWith('01') &&
    digits.length > country.maxRemainingDigits
  ) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length > country.maxRemainingDigits) {
    digits = digits.slice(1);
  }

  return digits.slice(0, country.maxRemainingDigits);
}

export function validateCountryPhoneNumber(
  country: CountryPhoneOption,
  rawRemaining: string
): {
  valid: boolean;
  remaining: string;
  fullNumber: string;
  error?: string;
} {
  const remaining = normalizeRemainingPhoneDigits(country, rawRemaining);
  const fullNumber = `${country.dialPrefix}${remaining}`;

  if (remaining.length < country.minRemainingDigits) {
    return {
      valid: false,
      remaining,
      fullNumber,
      error: `Enter ${country.minRemainingDigits}${
        country.minRemainingDigits === country.maxRemainingDigits
          ? ''
          : `–${country.maxRemainingDigits}`
      } digits after ${country.dialPrefix} for ${country.name}.`,
    };
  }

  if (!/^\+[0-9]{6,18}$/.test(fullNumber)) {
    return {
      valid: false,
      remaining,
      fullNumber,
      error: 'Enter a valid international phone number.',
    };
  }

  return {
    valid: true,
    remaining,
    fullNumber,
  };
}
