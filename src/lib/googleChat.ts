import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from './firebase';

export const GOOGLE_CHAT_SCOPES: string[] = [
  'https://www.googleapis.com/auth/chat.spaces',
  'https://www.googleapis.com/auth/chat.spaces.readonly',
  'https://www.googleapis.com/auth/chat.spaces.create',
  'https://www.googleapis.com/auth/chat.messages',
  'https://www.googleapis.com/auth/chat.messages.create',
  'https://www.googleapis.com/auth/chat.messages.readonly',
  'https://www.googleapis.com/auth/chat.memberships.readonly',
  'https://www.googleapis.com/auth/chat.users.readstate.readonly',
];

export const GOOGLE_CHAT_CONFIG_URL = `https://console.cloud.google.com/apis/api/chat.googleapis.com/hangouts-chat?project=${firebaseConfig.projectId}`;

export interface GoogleChatSpace {
  name: string;
  displayName?: string;
  type?: string;
  spaceType?: string;
}

export interface GoogleChatMessage {
  name: string;
  text?: string;
  createTime?: string;
  sender?: {
    name?: string;
    displayName?: string;
    type?: string;
  };
}

// Strict in-memory token cache (never stored in localStorage/sessionStorage)
let cachedGoogleChatToken: string | null = null;
let isConnectingGoogleChat = false;

export const initGoogleChatAuth = (
  onTokenAvailable?: (user: User, token: string) => void,
  onTokenCleared?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user && cachedGoogleChatToken) {
      if (onTokenAvailable) onTokenAvailable(user, cachedGoogleChatToken);
    } else if (!isConnectingGoogleChat) {
      cachedGoogleChatToken = null;
      if (onTokenCleared) onTokenCleared();
    }
  });
};

export const getGoogleChatAccessToken = (): string | null => cachedGoogleChatToken;

export const clearGoogleChatToken = (): void => {
  cachedGoogleChatToken = null;
};

export const connectGoogleChatAccount = async (): Promise<{
  user: User;
  accessToken: string;
}> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'consent select_account' });
  for (const scope of GOOGLE_CHAT_SCOPES) {
    provider.addScope(scope);
  }
  try {
    isConnectingGoogleChat = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain a Google Chat access token. Please try signing in again.');
    }
    cachedGoogleChatToken = credential.accessToken;
    return { user: result.user, accessToken: cachedGoogleChatToken };
  } finally {
    isConnectingGoogleChat = false;
  }
};

export class GoogleChatApiError extends Error {
  status: number;
  isAppNotConfigured: boolean;
  isWorkspaceRequired: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'GoogleChatApiError';
    this.status = status;
    const lower = message.toLowerCase();
    this.isAppNotConfigured =
      status === 404 ||
      lower.includes('google chat app not found') ||
      lower.includes('configure the app');
    this.isWorkspaceRequired =
      status === 403 &&
      (lower.includes('workspace') ||
        lower.includes('consumer') ||
        lower.includes('not supported') ||
        lower.includes('permission'));
  }
}

async function parseGoogleChatResponse<T>(res: Response): Promise<T> {
  const bodyText = await res.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = bodyText ? (JSON.parse(bodyText) as Record<string, unknown>) : {};
  } catch {
    // non-json response
  }

  if (!res.ok) {
    const errObj = parsed.error as { message?: string } | undefined;
    const message =
      errObj?.message ||
      (res.status === 404
        ? 'Google Chat app not found. To create a Chat app, you must turn on the Chat API and configure the app in the Google Cloud console.'
        : `Google Chat API error (HTTP ${res.status})`);
    throw new GoogleChatApiError(message, res.status);
  }
  return parsed as T;
}

export async function listGoogleChatSpaces(accessToken: string): Promise<GoogleChatSpace[]> {
  const res = await fetch('https://chat.googleapis.com/v1/spaces?pageSize=30', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const data = await parseGoogleChatResponse<{ spaces?: GoogleChatSpace[] }>(res);
  return Array.isArray(data.spaces) ? data.spaces : [];
}

export async function listGoogleChatMessages(
  accessToken: string,
  spaceName: string
): Promise<GoogleChatMessage[]> {
  const safeSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const res = await fetch(
    `https://chat.googleapis.com/v1/${safeSpace}/messages?pageSize=25&orderBy=createTime%20desc`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  const data = await parseGoogleChatResponse<{ messages?: GoogleChatMessage[] }>(res);
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function postGoogleChatMessage(
  accessToken: string,
  spaceName: string,
  text: string
): Promise<GoogleChatMessage> {
  const safeSpace = spaceName.startsWith('spaces/') ? spaceName : `spaces/${spaceName}`;
  const res = await fetch(`https://chat.googleapis.com/v1/${safeSpace}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text.trim().slice(0, 4000) }),
  });
  return parseGoogleChatResponse<GoogleChatMessage>(res);
}
