import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  GlobalHistogramBinarizer,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { GlobalKycCountry } from '../constants/globalKycCountries';
import { KycOcrExtractedFields } from './kycApi';

export type FreeScanMethod =
  | 'QR_CODE'
  | 'PDF_417'
  | 'AZTEC'
  | 'DATA_MATRIX'
  | 'BARCODE'
  | 'ICAO_MRZ'
  | 'LOCAL_TESSERACT_OCR';

export interface FreeDocumentScanResult {
  extracted: Partial<KycOcrExtractedFields>;
  detectedFieldsCount: number;
  method: FreeScanMethod;
  barcodeFormat?: string;
  rawQrSnippet?: string;
  confidence: number;
  notes: string;
  providerLabel: string;
}

interface RawBarcodeHit {
  text: string;
  format: string;
}

const ISO3_TO_NATIONALITY: Record<string, string> = {
  BGD: 'Bangladeshi',
  IND: 'Indian',
  PAK: 'Pakistani',
  USA: 'American',
  GBR: 'British',
  CAN: 'Canadian',
  AUS: 'Australian',
  ARE: 'Emirati',
  SAU: 'Saudi',
  MYS: 'Malaysian',
  SGP: 'Singaporean',
  IDN: 'Indonesian',
  PHL: 'Filipino',
  NGA: 'Nigerian',
  TUR: 'Turkish',
  DEU: 'German',
  FRA: 'French',
  ITA: 'Italian',
  ESP: 'Spanish',
  NLD: 'Dutch',
  BRA: 'Brazilian',
  MEX: 'Mexican',
  JPN: 'Japanese',
  KOR: 'South Korean',
  CHN: 'Chinese',
  VNM: 'Vietnamese',
  THA: 'Thai',
  NPL: 'Nepalese',
  LKA: 'Sri Lankan',
  EGY: 'Egyptian',
  ZAF: 'South African',
  KEN: 'Kenyan',
  GHA: 'Ghanaian',
  QAT: 'Qatari',
  KWT: 'Kuwaiti',
  OMN: 'Omani',
  BHR: 'Bahraini',
};

const MONTH_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

function normalizeDateString(raw: string): string {
  const s = raw.trim();
  if (!s) return '';

  // YYYY-MM-DD or YYYY/MM/DD
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) {
    return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  }

  // DD-MM-YYYY or DD/MM/YYYY or DD.MM.YYYY
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // If first part > 12, it's definitely DD-MM-YYYY; otherwise default DD-MM-YYYY for global IDs
    if (b > 12 && a <= 12) {
      return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    }
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  // DD MMM YYYY (e.g. 15 Jan 1995, common on BD NID & Passports)
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*[\s,.-]+(\d{4})$/);
  if (m) {
    const mon = MONTH_MAP[m[2].toUpperCase()];
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`;
  }

  // MMM DD YYYY
  m = s.match(/^([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2})[\s,.-]+(\d{4})$/);
  if (m) {
    const mon = MONTH_MAP[m[1].toUpperCase()];
    if (mon) return `${m[3]}-${mon}-${m[2].padStart(2, '0')}`;
  }

  // YYYYMMDD (8 digits)
  m = s.match(/^((?:19|20)\d{2})(\d{2})(\d{2})$/);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}`;
  }

  // MMDDYYYY (AAMVA US Driving License format)
  m = s.match(/^(\d{2})(\d{2})((?:19|20)\d{2})$/);
  if (m) {
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${m[3]}-${m[1]}-${m[2]}`;
    }
    if (dd >= 1 && dd <= 12 && mm >= 1 && mm <= 31) {
      return `${m[3]}-${m[2]}-${m[1]}`;
    }
  }

  return s.slice(0, 32);
}

function parseMrzYYMMDD(yymmdd: string, isExpiry: boolean): string {
  if (!/^\d{6}$/.test(yymmdd)) return '';
  const yy = Number(yymmdd.slice(0, 2));
  const mm = yymmdd.slice(2, 4);
  const dd = yymmdd.slice(4, 6);
  const currentYY = new Date().getFullYear() % 100;
  const century = isExpiry
    ? yy <= currentYY + 25
      ? '20'
      : '19'
    : yy <= currentYY
    ? '20'
    : '19';
  return `${century}${yymmdd.slice(0, 2)}-${mm}-${dd}`;
}

function cleanMrzName(raw: string): string {
  const [surnamePart, givenPart] = raw.split('<<');
  const surname = (surnamePart || '').replace(/<+/g, ' ').trim();
  const given = (givenPart || '').replace(/<+/g, ' ').trim();
  const combined = given ? `${given} ${surname}` : surname;
  return combined
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .slice(0, 120);
}

/**
 * Parses ICAO 9303 MRZ lines (TD3 Passport 2x44 or TD1 ID Card 3x30) from QR or OCR text.
 */
export function parseIcaoMrz(text: string): Partial<KycOcrExtractedFields> | null {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, '').toUpperCase())
    .filter((l) => l.length >= 26 && /^[A-Z0-9<]+$/.test(l));

  // TD3 Passport (2 lines ~44 chars, first starts with P<)
  for (let i = 0; i < lines.length - 1; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1];
    if (l1.startsWith('P') && l1.includes('<<') && l1.length >= 36 && l2.length >= 36) {
      const fullName = cleanMrzName(l1.slice(5));
      const docNum = l2.slice(0, 9).replace(/<+/g, '').trim();
      const natIso3 = l2.slice(10, 13).replace(/<+/g, '');
      const dob = parseMrzYYMMDD(l2.slice(13, 19), false);
      const expiry = parseMrzYYMMDD(l2.slice(21, 27), true);
      if (docNum || fullName) {
        return {
          fullName,
          documentNumber: docNum,
          nationality: ISO3_TO_NATIONALITY[natIso3] || natIso3,
          dateOfBirth: dob,
          expiryDate: expiry,
        };
      }
    }
  }

  // TD1 National ID (3 lines ~30 chars)
  for (let i = 0; i < lines.length - 2; i++) {
    const l1 = lines[i];
    const l2 = lines[i + 1];
    const l3 = lines[i + 2];
    if (
      (l1.startsWith('I') || l1.startsWith('A') || l1.startsWith('C')) &&
      l1.length >= 28 &&
      l2.length >= 28 &&
      l3.includes('<<')
    ) {
      const docNum = l1.slice(5, 14).replace(/<+/g, '').trim();
      const dob = parseMrzYYMMDD(l2.slice(0, 6), false);
      const expiry = parseMrzYYMMDD(l2.slice(8, 14), true);
      const natIso3 = l2.slice(15, 18).replace(/<+/g, '');
      const fullName = cleanMrzName(l3);
      if (docNum || fullName) {
        return {
          fullName,
          documentNumber: docNum,
          nationality: ISO3_TO_NATIONALITY[natIso3] || natIso3,
          dateOfBirth: dob,
          expiryDate: expiry,
        };
      }
    }
  }

  return null;
}

/**
 * Parses global government ID QR / PDF417 payloads:
 * - Bangladesh Smart NID PDF417 (<pin>, <name>, <DOB>, NM/NW/OL/BR/PE)
 * - US/Canada AAMVA Driving License PDF417 (DCS, DAC, DAQ, DBB, DBA, DBD, DAG...)
 * - India Aadhaar XML QR (<PrintLetterBarcodeData ... />)
 * - ICAO MRZ inside QR
 * - Universal JSON / XML / vCard / Key:Value / URL query QR codes
 */
export function parseDocumentQrPayload(
  rawText: string,
  countryHint?: GlobalKycCountry
): { extracted: Partial<KycOcrExtractedFields>; formatLabel: string } {
  const text = rawText.trim();
  const out: Partial<KycOcrExtractedFields> = {};

  // 1. Bangladesh Smart NID PDF417 XML-like (<pin>/<name>/<DOB>) or Smart Card v2 (NM/NW/OL/BR/PE)
  if (
    /<pin>/i.test(text) ||
    /<name>/i.test(text) ||
    /\bNM\s*[A-Za-z.\s'-]{2,}[\r\n\s]+(?:NW|OL)\s*\d{9,17}\b/.test(text)
  ) {
    const pinMatch = text.match(/<pin>([^<]+)<\/pin>/i) || text.match(/\bNW\s*(\d{10,17})\b/);
    const oldPinMatch = text.match(/\bOL\s*(\d{10,17})\b/);
    const nameMatch =
      text.match(/<name>([^<]+)<\/name>/i) ||
      text.match(/\bNM\s*([A-Za-z.\s'-]{3,80}?)(?=\s*(?:\r?\n|\b(?:NW|OL|BR|PE)\b|$))/);
    const dobMatch =
      text.match(/<DOB>([^<]+)<\/DOB>/i) ||
      text.match(/\bBR\s*(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}\s+[A-Za-z]{3}\s+\d{4}|\d{8})\b/);
    const issueMatch = text.match(/<issueDate>([^<]+)<\/issueDate>/i);
    const peMatch = text.match(/\bPE\s*([^\r\n]+)/);
    const addrMatch = text.match(/<address>([^<]+)<\/address>/i);

    if (nameMatch?.[1]) out.fullName = nameMatch[1].trim().slice(0, 120);
    if (pinMatch?.[1] || oldPinMatch?.[1]) {
      out.documentNumber = (pinMatch?.[1] || oldPinMatch?.[1] || '').trim().slice(0, 64);
    }
    if (dobMatch?.[1]) out.dateOfBirth = normalizeDateString(dobMatch[1]);
    if (issueMatch?.[1]) out.issueDate = normalizeDateString(issueMatch[1]);
    if (peMatch?.[1]) {
      const peVal = peMatch[1].trim();
      if (/^(\d{4}[-/]\d{2}[-/]\d{2}|\d{8})$/.test(peVal)) {
        if (!out.issueDate) out.issueDate = normalizeDateString(peVal);
      } else if (!out.address) {
        out.address = peVal.slice(0, 260);
      }
    }
    if (addrMatch?.[1]) out.address = addrMatch[1].trim().slice(0, 260);
    out.nationality = 'Bangladeshi';
    return { extracted: out, formatLabel: 'Bangladesh Smart NID PDF417' };
  }

  // 2. US / Canada AAMVA Driving License PDF417
  if (text.includes('ANSI ') || (/\bDCS/.test(text) && /(?:^|[\r\n\x1e\x0a]|DL|ID)DAQ/.test(text))) {
    const getTag = (code: string) => {
      const m = text.match(new RegExp(`(?:^|[\\r\\n\\x1e\\x0a]|DL|ID)${code}([^\\r\\n\\x1e\\x0a]+)`));
      return m?.[1]?.trim() || '';
    };
    const last = getTag('DCS');
    const first = getTag('DAC') || getTag('DCT');
    const middle = getTag('DAD');
    const full = getTag('DAA') || [first, middle, last].filter(Boolean).join(' ');
    const docNum = getTag('DAQ');
    const dob = getTag('DBB');
    const issue = getTag('DBD');
    const expiry = getTag('DBA');
    const street = getTag('DAG');
    const city = getTag('DAI');
    const state = getTag('DAJ');
    const postal = getTag('DAK');
    const country = getTag('DCG');

    if (full) out.fullName = full.replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (docNum) out.documentNumber = docNum.slice(0, 64);
    if (dob) out.dateOfBirth = normalizeDateString(dob);
    if (issue) out.issueDate = normalizeDateString(issue);
    if (expiry) out.expiryDate = normalizeDateString(expiry);
    const addr = [street, city, state, postal].filter(Boolean).join(', ');
    if (addr) out.address = addr.slice(0, 260);
    if (country) out.nationality = ISO3_TO_NATIONALITY[country] || country;
    return { extracted: out, formatLabel: 'AAMVA Driving License PDF417' };
  }

  // 3. India Aadhaar XML QR (<PrintLetterBarcodeData uid="..." name="..." ... />)
  if (/PrintLetterBarcodeData/i.test(text)) {
    const attr = (k: string) => {
      const m = text.match(new RegExp(`${k}\\s*=\\s*["']([^"']+)["']`, 'i'));
      return m?.[1]?.trim() || '';
    };
    const uid = attr('uid');
    const name = attr('name');
    const dob = attr('dob') || attr('yob');
    const addr = [
      attr('house'),
      attr('street'),
      attr('loc'),
      attr('vtc'),
      attr('dist'),
      attr('state'),
      attr('pc'),
    ]
      .filter(Boolean)
      .join(', ');
    if (name) out.fullName = name.slice(0, 120);
    if (uid) out.documentNumber = uid.slice(0, 64);
    if (dob) out.dateOfBirth = normalizeDateString(dob);
    if (addr) out.address = addr.slice(0, 260);
    out.nationality = 'Indian';
    return { extracted: out, formatLabel: 'India Aadhaar QR Code' };
  }

  // 4. ICAO MRZ embedded inside QR
  const mrz = parseIcaoMrz(text);
  if (mrz) {
    return { extracted: mrz, formatLabel: 'ICAO 9303 MRZ QR' };
  }

  // 5. JSON QR payload
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const pick = (...keys: string[]) => {
        for (const k of keys) {
          for (const jk of Object.keys(json)) {
            if (jk.toLowerCase().replace(/[^a-z0-9]/g, '') === k) {
              const v = json[jk];
              if (v !== undefined && v !== null && String(v).trim()) {
                return String(v).trim();
              }
            }
          }
        }
        return '';
      };

      const name = pick('fullname', 'name', 'holdername', 'legalname', 'surname');
      const docNum = pick(
        'documentnumber',
        'idnumber',
        'nid',
        'nidnumber',
        'passportnumber',
        'passport',
        'licensenumber',
        'dlnumber',
        'nationalid',
        'pin',
        'uid',
        'cnic',
        'id'
      );
      const dob = pick('dateofbirth', 'dob', 'birthdate', 'birthday');
      const nat = pick('nationality', 'country', 'citizenship');
      const issue = pick('issuedate', 'dateofissue', 'issued');
      const expiry = pick('expirydate', 'expirationdate', 'validuntil', 'exp', 'expiry');
      const address = pick('address', 'residentialaddress', 'presentaddress', 'permanentaddress');

      if (name) out.fullName = name.slice(0, 120);
      if (docNum) out.documentNumber = docNum.slice(0, 64);
      if (dob) out.dateOfBirth = normalizeDateString(dob);
      if (nat) out.nationality = nat.slice(0, 80);
      if (issue) out.issueDate = normalizeDateString(issue);
      if (expiry) out.expiryDate = normalizeDateString(expiry);
      if (address) out.address = address.slice(0, 260);
      return { extracted: out, formatLabel: 'Structured JSON ID QR' };
    } catch {
      // Fall through to generic parser
    }
  }

  // 6. URL query string QR (some e-IDs/licenses encode verification URLs with params)
  if (/^https?:\/\//i.test(text)) {
    try {
      const u = new URL(text);
      const qp = (keys: string[]) => {
        for (const k of keys) {
          const v = u.searchParams.get(k);
          if (v && v.trim()) return v.trim();
        }
        return '';
      };
      const name = qp(['name', 'full_name', 'fullName', 'holder']);
      const docNum = qp(['id', 'nid', 'id_number', 'doc', 'passport', 'license', 'dl', 'pin', 'number']);
      const dob = qp(['dob', 'birth_date', 'birthdate']);
      const nat = qp(['nationality', 'country']);
      const expiry = qp(['expiry', 'exp', 'valid_until']);
      const address = qp(['address', 'addr']);

      if (name) out.fullName = name.slice(0, 120);
      if (docNum) out.documentNumber = docNum.slice(0, 64);
      if (dob) out.dateOfBirth = normalizeDateString(dob);
      if (nat) out.nationality = nat.slice(0, 80);
      if (expiry) out.expiryDate = normalizeDateString(expiry);
      if (address) out.address = address.slice(0, 260);
      if (Object.keys(out).length > 0) {
        return { extracted: out, formatLabel: 'Government Verification URL QR' };
      }
    } catch {
      // Ignore invalid URL
    }
  }

  // 7. vCard / Key:Value / Key=Value / Pipe-separated generic document QR
  const lines = text.split(/[\r\n;|]+/).map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const kv = line.match(/^([A-Za-z0-9 _.-]{2,32})\s*[:=]\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase().replace(/[^a-z0-9]/g, '');
    const val = kv[2].trim();
    if (!val) continue;

    if (!out.fullName && ['name', 'fullname', 'fn', 'holder', 'holdername', 'legalname'].includes(key)) {
      out.fullName = val.slice(0, 120);
    } else if (
      !out.documentNumber &&
      ['id', 'idno', 'idnumber', 'nid', 'nidno', 'pin', 'passport', 'passportno', 'license', 'licenseno', 'dl', 'cnic', 'documentno', 'documentnumber', 'number'].includes(key)
    ) {
      out.documentNumber = val.slice(0, 64);
    } else if (!out.dateOfBirth && ['dob', 'dateofbirth', 'birth', 'birthdate', 'bday'].includes(key)) {
      out.dateOfBirth = normalizeDateString(val);
    } else if (!out.nationality && ['nationality', 'country', 'citizen', 'citizenship'].includes(key)) {
      out.nationality = val.slice(0, 80);
    } else if (!out.issueDate && ['issue', 'issuedate', 'dateofissue', 'issued'].includes(key)) {
      out.issueDate = normalizeDateString(val);
    } else if (!out.expiryDate && ['expiry', 'expirydate', 'exp', 'validuntil', 'expiration', 'expirationdate'].includes(key)) {
      out.expiryDate = normalizeDateString(val);
    } else if (!out.address && ['address', 'addr', 'adr', 'residence', 'location'].includes(key)) {
      out.address = val.replace(/;+/g, ', ').slice(0, 260);
    }
  }

  // Fallback: if raw text is a single clean alphanumeric ID/passport number
  if (!out.documentNumber && /^[A-Za-z0-9-]{6,22}$/.test(text)) {
    out.documentNumber = text;
  }

  if (!out.nationality && countryHint?.nationality && Object.keys(out).length > 0) {
    out.nationality = countryHint.nationality;
  }

  return { extracted: out, formatLabel: 'Document QR / 2D Barcode' };
}

/**
 * Extracts labeled document fields from raw OCR text (Passport / NID / Driving License).
 */
export function parseOcrDocumentText(
  ocrText: string,
  countryHint?: GlobalKycCountry
): { extracted: Partial<KycOcrExtractedFields>; usedMrz: boolean } {
  const mrz = parseIcaoMrz(ocrText);
  const out: Partial<KycOcrExtractedFields> = mrz ? { ...mrz } : {};

  const cleaned = ocrText.replace(/\r/g, '');
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

  const findAfterLabel = (patterns: RegExp[]): string => {
    for (let i = 0; i < lines.length; i++) {
      for (const rx of patterns) {
        const match = lines[i].match(rx);
        if (match) {
          const inline = (match[1] || '').trim();
          if (inline.length >= 2) return inline;
          if (lines[i + 1] && lines[i + 1].length >= 2) return lines[i + 1].trim();
        }
      }
    }
    return '';
  };

  if (!out.fullName) {
    const nameCandidate = findAfterLabel([
      /(?:full\s*name|holder'?s?\s*name|name)\s*[:.-]?\s*([A-Za-z][A-Za-z.\s'-]{2,60})$/i,
    ]);
    if (nameCandidate && !/^(of|father|mother|spouse|birth)/i.test(nameCandidate)) {
      out.fullName = nameCandidate.replace(/[^A-Za-z.\s'-]/g, '').trim().slice(0, 120);
    }
  }

  if (!out.documentNumber) {
    const idCandidate = findAfterLabel([
      /(?:id\s*no|nid\s*no|nid|passport\s*no|license\s*no|licence\s*no|dl\s*no|card\s*no|document\s*no|cnic|aadhaar)\s*[:.#-]?\s*([A-Za-z0-9\s-]{6,24})/i,
    ]);
    if (idCandidate) {
      const compact = idCandidate.replace(/\s+/g, ' ').trim();
      const token = compact.match(/[A-Za-z0-9-]{6,22}/);
      if (token) out.documentNumber = token[0];
    } else {
      // Pattern match for 10/13/17-digit NID or passport-like code
      const nidDigits = cleaned.match(/\b(\d{10}|\d{13}|\d{17})\b/);
      if (nidDigits) out.documentNumber = nidDigits[1];
    }
  }

  if (!out.dateOfBirth) {
    const dobRaw = findAfterLabel([
      /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\s*[:.-]?\s*([0-9A-Za-z\s./-]{6,20})/i,
    ]);
    if (dobRaw) out.dateOfBirth = normalizeDateString(dobRaw);
  }

  if (!out.issueDate) {
    const issueRaw = findAfterLabel([
      /(?:date\s*of\s*issue|issue\s*date|issued)\s*[:.-]?\s*([0-9A-Za-z\s./-]{6,20})/i,
    ]);
    if (issueRaw) out.issueDate = normalizeDateString(issueRaw);
  }

  if (!out.expiryDate) {
    const expRaw = findAfterLabel([
      /(?:date\s*of\s*expiry|expiry\s*date|expiration|valid\s*(?:until|thru|to)|expires)\s*[:.-]?\s*([0-9A-Za-z\s./-]{6,20})/i,
    ]);
    if (expRaw) out.expiryDate = normalizeDateString(expRaw);
  }

  if (!out.address) {
    const addrRaw = findAfterLabel([
      /(?:address|residence|present\s*address|permanent\s*address)\s*[:.-]?\s*(.{6,160})$/i,
    ]);
    if (addrRaw) out.address = addrRaw.slice(0, 260);
  }

  if (!out.nationality) {
    const natRaw = findAfterLabel([
      /(?:nationality|citizenship)\s*[:.-]?\s*([A-Za-z\s]{3,40})$/i,
    ]);
    if (natRaw) out.nationality = natRaw.trim().slice(0, 80);
    else if (countryHint?.nationality) out.nationality = countryHint.nationality;
  }

  return { extracted: out, usedMrz: Boolean(mrz) };
}

function createZxingReader(): MultiFormatReader {
  const hints = new Map();
  hints.set(DecodeHintType.TRY_HARDER, true);
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.PDF_417,
    BarcodeFormat.AZTEC,
    BarcodeFormat.DATA_MATRIX,
    BarcodeFormat.CODE_128,
  ]);
  const reader = new MultiFormatReader();
  reader.setHints(hints);
  return reader;
}

function decodeCanvasWithZxing(canvas: HTMLCanvasElement, enhanceContrast = false): RawBarcodeHit | null {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  const { width, height } = canvas;
  if (width < 16 || height < 16) return null;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const luminances = new Uint8ClampedArray(width * height);

  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    let lum = (data[i] * 77 + data[i + 1] * 150 + data[i + 2] * 29) >> 8;
    if (enhanceContrast) {
      lum = lum < 128 ? Math.max(0, Math.round(lum * 0.72)) : Math.min(255, Math.round(lum * 1.25));
    }
    luminances[p] = lum;
  }

  const reader = createZxingReader();
  const source = new RGBLuminanceSource(luminances, width, height);

  try {
    const result = reader.decode(new BinaryBitmap(new HybridBinarizer(source)));
    return {
      text: result.getText(),
      format: BarcodeFormat[result.getBarcodeFormat()] || 'QR_CODE',
    };
  } catch {
    // Fallback to GlobalHistogramBinarizer for PDF417 / uneven lighting
    try {
      reader.reset();
      const result = reader.decode(new BinaryBitmap(new GlobalHistogramBinarizer(source)));
      return {
        text: result.getText(),
        format: BarcodeFormat[result.getBarcodeFormat()] || 'QR_CODE',
      };
    } catch {
      return null;
    }
  }
}

async function decodeWithNativeBarcodeDetector(
  source: HTMLCanvasElement | HTMLImageElement | HTMLVideoElement
): Promise<RawBarcodeHit | null> {
  const win = window as unknown as {
    BarcodeDetector?: new (opts?: { formats: string[] }) => {
      detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string; format: string }>>;
    };
  };
  if (typeof win.BarcodeDetector !== 'function') return null;

  try {
    const detector = new win.BarcodeDetector({
      formats: ['qr_code', 'pdf417', 'aztec', 'data_matrix', 'code_128'],
    });
    const hits = await detector.detect(source);
    if (hits && hits.length > 0 && hits[0].rawValue) {
      return {
        text: hits[0].rawValue,
        format: hits[0].format.toUpperCase(),
      };
    }
  } catch {
    // Browser BarcodeDetector may not support all formats; fall through to ZXing
  }
  return null;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load document image for scanning.'));
    img.src = src;
  });
}

function drawRegionToCanvas(
  img: HTMLImageElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  maxDim = 1400
): HTMLCanvasElement {
  const scale = Math.min(maxDim / sw, maxDim / sh, 1.5);
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }
  return canvas;
}

/**
 * Multi-region high-accuracy QR & PDF417 barcode decoder for uploaded document images.
 * Scans full frame + bottom-half (NID/DL PDF417) + right-half (ID QR) + high-contrast pass.
 */
export async function decodeDocumentBarcodeFromImage(src: string): Promise<RawBarcodeHit | null> {
  const img = await loadImageElement(src);
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  // Pass 1: Full image (Native BarcodeDetector -> ZXing)
  const fullCanvas = drawRegionToCanvas(img, 0, 0, iw, ih, 1500);
  const nativeHit = await decodeWithNativeBarcodeDetector(fullCanvas);
  if (nativeHit) return nativeHit;

  const zxingFull = decodeCanvasWithZxing(fullCanvas, false);
  if (zxingFull) return zxingFull;

  // Pass 2: Bottom 55% crop (Bangladesh Smart NID PDF417 & US/EU DL PDF417)
  const bottomCanvas = drawRegionToCanvas(img, 0, Math.floor(ih * 0.45), iw, Math.ceil(ih * 0.55), 1400);
  const zxingBottom =
    decodeCanvasWithZxing(bottomCanvas, false) || decodeCanvasWithZxing(bottomCanvas, true);
  if (zxingBottom) return zxingBottom;

  // Pass 3: Right 55% crop (National ID QR codes printed on right side)
  const rightCanvas = drawRegionToCanvas(img, Math.floor(iw * 0.45), 0, Math.ceil(iw * 0.55), ih, 1200);
  const zxingRight =
    decodeCanvasWithZxing(rightCanvas, false) || decodeCanvasWithZxing(rightCanvas, true);
  if (zxingRight) return zxingRight;

  // Pass 4: Full image high-contrast pass
  const zxingContrast = decodeCanvasWithZxing(fullCanvas, true);
  if (zxingContrast) return zxingContrast;

  return null;
}

/**
 * Live camera frame QR / PDF417 decoder for instant real-time ID scanning.
 */
export async function decodeDocumentBarcodeFromVideo(
  video: HTMLVideoElement
): Promise<RawBarcodeHit | null> {
  if (!video.videoWidth || !video.videoHeight) return null;

  const nativeHit = await decodeWithNativeBarcodeDetector(video);
  if (nativeHit) return nativeHit;

  const canvas = document.createElement('canvas');
  const maxDim = 960;
  const scale = Math.min(maxDim / video.videoWidth, maxDim / video.videoHeight, 1);
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  return decodeCanvasWithZxing(canvas, false) || decodeCanvasWithZxing(canvas, true);
}

function mapFormatToMethod(fmt: string): FreeScanMethod {
  const f = fmt.toUpperCase();
  if (f.includes('QR')) return 'QR_CODE';
  if (f.includes('PDF')) return 'PDF_417';
  if (f.includes('AZTEC')) return 'AZTEC';
  if (f.includes('DATA_MATRIX') || f.includes('DATAMATRIX')) return 'DATA_MATRIX';
  return 'BARCODE';
}

function countNonEmptyFields(fields: Partial<KycOcrExtractedFields>): number {
  return Object.values(fields).filter((v) => typeof v === 'string' && v.trim().length > 0).length;
}

/**
 * 100% FREE ($0 cost) automatic document scanner triggered immediately on document upload/update:
 * 1. Scans QR / PDF417 / Aztec / DataMatrix barcode on high-res document image.
 * 2. If no barcode found (or core fields still missing), runs free open-source local Tesseract.js OCR + ICAO MRZ parser in browser!
 */
export async function scanDocumentFreeAutoFill(params: {
  imageSrc: string;
  countryHint?: GlobalKycCountry;
  runLocalOcrFallback?: boolean;
  onProgress?: (statusText: string) => void;
}): Promise<FreeDocumentScanResult> {
  const { imageSrc, countryHint, runLocalOcrFallback = true, onProgress } = params;

  onProgress?.('Scanning document QR code & PDF417 barcode (Free Local Engine)...');
  const barcodeHit = await decodeDocumentBarcodeFromImage(imageSrc);

  if (barcodeHit) {
    const parsed = parseDocumentQrPayload(barcodeHit.text, countryHint);
    const fieldCount = countNonEmptyFields(parsed.extracted);
    const method = mapFormatToMethod(barcodeHit.format);

    return {
      extracted: parsed.extracted,
      detectedFieldsCount: fieldCount,
      method,
      barcodeFormat: barcodeHit.format,
      rawQrSnippet: barcodeHit.text.slice(0, 140),
      confidence: fieldCount >= 3 ? 96 : fieldCount >= 1 ? 88 : 74,
      notes:
        fieldCount > 0
          ? `Decoded ${parsed.formatLabel} (${barcodeHit.format}) instantly at $0 cost and auto-filled ${fieldCount} verified field${fieldCount === 1 ? '' : 's'}.`
          : `Detected ${barcodeHit.format} barcode on document. Please review and verify the auto-filled details below.`,
      providerLabel: `Free Local QR/Barcode Scanner (${barcodeHit.format})`,
    };
  }

  if (!runLocalOcrFallback) {
    return {
      extracted: {},
      detectedFieldsCount: 0,
      method: 'LOCAL_TESSERACT_OCR',
      confidence: 0,
      notes: 'No QR code or PDF417 barcode found on this side of the document.',
      providerLabel: 'Free Local QR/Barcode Scanner',
    };
  }

  // Pass 2: 100% Free Open-Source Client-Side Tesseract.js OCR + ICAO MRZ Parser
  onProgress?.('No QR detected on this side — running 100% Free Local OCR & MRZ reader...');
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng');
  try {
    const ret = await worker.recognize(imageSrc);
    const rawText = ret.data?.text || '';
    const rawConf = Math.round(Number(ret.data?.confidence || 0));
    const { extracted, usedMrz } = parseOcrDocumentText(rawText, countryHint);
    const fieldCount = countNonEmptyFields(extracted);

    return {
      extracted,
      detectedFieldsCount: fieldCount,
      method: usedMrz ? 'ICAO_MRZ' : 'LOCAL_TESSERACT_OCR',
      confidence: usedMrz ? Math.max(88, Math.min(98, rawConf || 90)) : Math.min(92, Math.max(35, rawConf)),
      notes: usedMrz
        ? `Read ICAO Machine-Readable Zone (MRZ) locally at $0 cost and auto-filled ${fieldCount} document fields.`
        : fieldCount > 0
        ? `Extracted ${fieldCount} field${fieldCount === 1 ? '' : 's'} using 100% Free Local Open-Source OCR. Upload the Back Side if your ID has a QR/PDF417 code for instant 96% auto-fill.`
        : 'Scanned image locally ($0 cost), but text clarity was low. Try uploading the side with a QR/PDF417 barcode or a brighter photo.',
      providerLabel: usedMrz
        ? 'Free Local Passport/ID MRZ Reader ($0)'
        : 'Free Local Open-Source OCR (Tesseract.js)',
    };
  } finally {
    await worker.terminate();
  }
}
