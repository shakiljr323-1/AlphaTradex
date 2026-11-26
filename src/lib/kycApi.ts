import { KycApiVerificationStatus, KycProviderId } from '../types/platform';

export interface KycProviderStatusItem {
  id: KycProviderId;
  name: string;
  tier: 'FREE' | 'ENTERPRISE_API' | 'CUSTOM_API';
  mode: 'free_builtin' | 'live_api' | 'webhook';
  configured: boolean;
  envVars: string[];
  webhookUrlSafe?: boolean | null;
  description: string;
}

export interface KycProviderStatusResponse {
  defaultProvider: KycProviderId;
  providers: KycProviderStatusItem[];
}

export interface KycOcrExtractedFields {
  fullName: string;
  dateOfBirth: string;
  documentNumber: string;
  nationality: string;
  issueDate: string;
  expiryDate: string;
  address: string;
}

export interface KycOcrExtractRequest {
  countryCode: string;
  countryName: string;
  nationalityHint?: string;
  idType: 'NID' | 'Passport' | 'Driving License';
  idNumber?: string;
  currentFullName?: string;
  frontImageDataUrl?: string;
  backImageDataUrl?: string;
  selfieDataUrl?: string;
}

export interface KycOcrExtractResponse {
  extracted: KycOcrExtractedFields;
  confidence: number;
  livenessCheckPassed: boolean;
  matchedInputId: boolean;
  extractionNotes: string;
  verificationSource: 'FREE_GEMINI_OCR' | 'FORMAT_SMART_PARSE';
  liveApiStatus: KycApiVerificationStatus;
  providerUsed: string;
}

export async function fetchKycProviderStatus(): Promise<KycProviderStatusResponse> {
  const res = await fetch('/api/kyc/provider-status', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = (await res.json().catch(() => ({}))) as KycProviderStatusResponse & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || 'Unable to load KYC provider configuration status.');
  }
  return data;
}

export async function extractKycDocumentOcr(
  payload: KycOcrExtractRequest
): Promise<KycOcrExtractResponse> {
  const res = await fetch('/api/kyc/ocr-extract', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as KycOcrExtractResponse & {
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || 'Document OCR extraction failed. Please check the photo clarity and retry.');
  }

  return data;
}
