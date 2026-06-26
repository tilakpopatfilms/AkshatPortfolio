import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
  AuthCredential
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  getDocFromServer
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configure Google OAuth Provider
export const provider = new GoogleAuthProvider();

// Scopes required for Google Forms read/write and Google Drive listing
const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/forms.body",
  "https://www.googleapis.com/auth/forms.body.readonly",
  "https://www.googleapis.com/auth/forms.responses.readonly"
];

SCOPES.forEach(scope => provider.addScope(scope));

// In-memory cache for Google Access Token
let cachedAccessToken: string | null = null;
let isSigningIn = false;

/**
 * Validate connection to Firestore. Required by guidelines.
 */
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, "configs", "google_forms"));
    console.log("Firestore connection test: OK");
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

// Run connection validation
testConnection();

/**
 * Initialize Auth State Listener. Call this on application boot.
 */
export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

/**
 * Google Sign In Flow. Retrieves user info and in-memory access token.
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error("Failed to retrieve Google OAuth access token.");
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error("Google Authentication failed:", error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Retrieves the currently cached Google access token.
 */
export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

/**
 * Sign out of current Firebase / Google session.
 */
export const googleSignOut = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

// Form settings data structure
export interface GoogleFormsConfig {
  formId: string;
  prefilledUrl?: string;
  nameEntryId?: string;
  emailEntryId?: string;
  subjectEntryId?: string;
  messageEntryId?: string;
  isEnabled: boolean;
  useWeb3Forms: boolean;
  updatedAt: string;
  updatedBy: string;
}

/**
 * Load Google Forms configuration from Firestore.
 */
export const loadFormsConfig = async (): Promise<GoogleFormsConfig | null> => {
  try {
    const configDoc = await getDoc(doc(db, "configs", "google_forms"));
    if (configDoc.exists()) {
      return configDoc.data() as GoogleFormsConfig;
    }
    return null;
  } catch (error) {
    console.error("Failed to load forms config from Firestore:", error);
    return null;
  }
};

/**
 * Save Google Forms configuration to Firestore. Only permitted for admin.
 */
export const saveFormsConfig = async (config: GoogleFormsConfig): Promise<boolean> => {
  try {
    await setDoc(doc(db, "configs", "google_forms"), config);
    return true;
  } catch (error) {
    console.error("Failed to save forms config to Firestore:", error);
    return false;
  }
};

export interface FormQuestion {
  id: string;
  title: string;
  type: string;
}

export interface FormResponseData {
  responseId: string;
  submittedAt: string;
  answers: { [questionTitle: string]: string };
}

/**
 * Parse a prefilled Google Form URL and extract Form ID and Entry parameters.
 */
export const parsePrefilledUrl = (urlStr: string) => {
  try {
    const url = new URL(urlStr);
    
    // Extract Form ID
    // Format: https://docs.google.com/forms/d/e/1FAIpQLSf.../viewform
    const match = url.pathname.match(/\/forms\/d\/e\/([A-Za-z0-9_-]+)/);
    const formId = match ? match[1] : "";

    const entries: { [key: string]: string } = {};
    url.searchParams.forEach((value, key) => {
      if (key.startsWith("entry.")) {
        entries[key] = value;
      }
    });

    // Try to auto-map based on dummy values passed in prefilled url
    let nameEntry = "";
    let emailEntry = "";
    let subjectEntry = "";
    let messageEntry = "";

    Object.entries(entries).forEach(([key, value]) => {
      const lowerVal = value.toLowerCase();
      if (lowerVal.includes("name")) nameEntry = key;
      else if (lowerVal.includes("email") || lowerVal.includes("@")) emailEntry = key;
      else if (lowerVal.includes("subject") || lowerVal.includes("title")) subjectEntry = key;
      else if (lowerVal.includes("message") || lowerVal.includes("body") || lowerVal.includes("text")) messageEntry = key;
    });

    // If auto-map fell back, use defaults from key ordering
    const keys = Object.keys(entries);
    if (!nameEntry && keys.length > 0) nameEntry = keys[0];
    if (!emailEntry && keys.length > 1) emailEntry = keys[1];
    if (!subjectEntry && keys.length > 2) subjectEntry = keys[2];
    if (!messageEntry && keys.length > 3) messageEntry = keys[3];

    return {
      success: !!formId,
      formId,
      entries,
      autoMap: {
        nameEntry,
        emailEntry,
        subjectEntry,
        messageEntry
      }
    };
  } catch (error) {
    console.error("Failed to parse prefilled Google Forms URL:", error);
    return { success: false, formId: "", entries: {}, autoMap: {} };
  }
};

/**
 * Fetch Google Forms structure and all responses.
 * Maps question IDs to titles to produce a human-readable list.
 */
export const fetchFormResponses = async (formId: string): Promise<FormResponseData[]> => {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("User is not authenticated or access token has expired.");
  }

  try {
    // 1. Fetch form metadata to get question titles
    const formRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!formRes.ok) {
      throw new Error(`Failed to fetch Form info: ${formRes.statusText}`);
    }
    const formData = await formRes.json();

    // Map question IDs to titles
    const questionMap: { [questionId: string]: string } = {};
    formData.items?.forEach((item: any) => {
      if (item.questionItem?.question) {
        questionMap[item.questionItem.question.questionId] = item.title || "Question";
      }
    });

    // 2. Fetch responses
    const responsesRes = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!responsesRes.ok) {
      throw new Error(`Failed to fetch Form responses: ${responsesRes.statusText}`);
    }
    const responsesData = await responsesRes.json();

    // 3. Map responses to human-readable format
    const formattedResponses: FormResponseData[] = (responsesData.responses || []).map((resp: any) => {
      const answers: { [title: string]: string } = {};
      
      Object.values(resp.answers || {}).forEach((answerObj: any) => {
        const qId = answerObj.questionId;
        const qTitle = questionMap[qId] || "Unknown Question";
        const textValues = answerObj.textAnswers?.answers?.map((a: any) => a.value).join(", ") || "";
        answers[qTitle] = textValues;
      });

      return {
        responseId: resp.responseId,
        submittedAt: new Date(resp.lastSubmittedTime || resp.createTime).toLocaleString(),
        answers
      };
    });

    return formattedResponses;
  } catch (error) {
    console.error("Error fetching Google Forms responses:", error);
    throw error;
  }
};
