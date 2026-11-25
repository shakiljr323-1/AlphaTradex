import { getApps, initializeApp } from 'firebase/app';
import {
  ConfirmationResult,
  getAuth,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

function getPhoneVerifyAuth() {
  const existing = getApps().find((a) => a.name === 'phone-verify-helper');
  const helperApp = existing || initializeApp(firebaseConfig, 'phone-verify-helper');
  return getAuth(helperApp);
}

export async function sendFirebasePhoneOtp(
  e164PhoneNumber: string,
  recaptchaContainer: HTMLElement
): Promise<{ confirmation: ConfirmationResult; clearRecaptcha: () => void }> {
  const phoneAuth = getPhoneVerifyAuth();
  recaptchaContainer.innerHTML = '';
  const verifier = new RecaptchaVerifier(phoneAuth, recaptchaContainer, {
    size: 'invisible',
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const confirmation = await Promise.race([
      signInWithPhoneNumber(phoneAuth, e164PhoneNumber, verifier),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          const timeoutErr = Object.assign(
            new Error('SMS verification timed out while loading reCAPTCHA.'),
            { code: 'auth/captcha-check-failed' }
          );
          reject(timeoutErr);
        }, 15000);
      }),
    ]);
    if (timer) clearTimeout(timer);
    return {
      confirmation,
      clearRecaptcha: () => {
        try {
          verifier.clear();
        } catch {
          // Ignore verifier cleanup error
        }
      },
    };
  } catch (err) {
    if (timer) clearTimeout(timer);
    try {
      verifier.clear();
    } catch {
      // Ignore verifier cleanup error
    }
    throw err;
  }
}

export async function confirmFirebasePhoneOtp(
  confirmation: ConfirmationResult,
  otpCode: string,
  expectedE164Phone: string
): Promise<boolean> {
  const cred = await confirmation.confirm(otpCode.trim());
  const verifiedPhone = cred.user.phoneNumber || '';
  const phoneAuth = getPhoneVerifyAuth();
  try {
    await signOut(phoneAuth);
  } catch {
    // Ignore helper sign-out error
  }
  return verifiedPhone === expectedE164Phone || Boolean(verifiedPhone);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testConnection();
