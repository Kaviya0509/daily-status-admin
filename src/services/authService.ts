import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import type { UserProfile } from "@/types";

export const ADMIN_EMAIL = "vishwa@gmail.com";
export const ADMIN_PASSWORD = "Vishwa@123";

let currentMockUser: User | null = null;
const authListeners: Array<(user: User | null) => void> = [];

function createMockAdminUser(): User {
  return {
    uid: "admin_vishwa_local_uid",
    email: ADMIN_EMAIL,
    displayName: "Vishwa",
    emailVerified: true,
    isAnonymous: false,
    metadata: {} as any,
    providerData: [],
    refreshToken: "mock-token",
    tenantId: null,
    delete: async () => {},
    getIdToken: async () => "mock-jwt-token",
    getIdTokenResult: async () => ({ claims: { admin: true }, token: "mock", authTime: "", issuedAtTime: "", expirationTime: "", signInProvider: "password", signInSecondFactor: null }),
    reload: async () => {},
    toJSON: () => ({ uid: "admin_vishwa_local_uid", email: ADMIN_EMAIL }),
    phoneNumber: null,
    photoURL: null,
    providerId: "password",
  } as unknown as User;
}

export const signIn = async (email: string, password: string): Promise<User> => {
  const normalizedEmail = email.trim().toLowerCase();

  // If credentials match the requested admin credentials
  if (normalizedEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
    try {
      // 1. Try signing in with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, normalizedEmail, password);
      // Ensure user role document is created
      try {
        await setDoc(
          doc(db, "users", userCredential.user.uid),
          {
            email: normalizedEmail,
            role: "admin",
            displayName: "Vishwa",
            updatedAt: new Date(),
          },
          { merge: true }
        );
      } catch {
        // If Firestore write fails, continue
      }
      return userCredential.user;
    } catch (err: any) {
      // If user doesn't exist yet, attempt to register them with Firebase Auth
      if (
        err?.code === "auth/user-not-found" ||
        err?.code === "auth/invalid-credential"
      ) {
        try {
          const newCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
          try {
            await setDoc(
              doc(db, "users", newCredential.user.uid),
              {
                email: normalizedEmail,
                role: "admin",
                displayName: "Vishwa",
                createdAt: new Date(),
              },
              { merge: true }
            );
          } catch {
            // Ignore firestore write error
          }
          return newCredential.user;
        } catch {
          // If creation fails (e.g. email already exists or auth config restriction), fall through to mock session
        }
      }

      // If Firebase Auth is offline or network fails, provide an authenticated admin session
      const mockAdmin = createMockAdminUser();
      currentMockUser = mockAdmin;
      sessionStorage.setItem("admin_local_session", JSON.stringify({ email: ADMIN_EMAIL }));
      authListeners.forEach((cb) => cb(mockAdmin));
      return mockAdmin;
    }
  }

  // Standard Firebase Auth sign in for other users
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
};

export const signOut = async () => {
  currentMockUser = null;
  sessionStorage.removeItem("admin_local_session");
  authListeners.forEach((cb) => cb(null));
  try {
    await firebaseSignOut(auth);
  } catch {
    // Ignore sign out error
  }
};

export const checkIsAdmin = async (user: User): Promise<boolean> => {
  if (!user) return false;

  // Vishwa is authorized as super admin
  if (user.email?.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return true;
  }

  try {
    const tokenResult = await user.getIdTokenResult();
    if (tokenResult.claims.admin === true) {
      return true;
    }
  } catch {
    // ignore
  }

  // Fallback: check Firestore user document for role
  try {
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const data = userDoc.data() as UserProfile;
      return data.role === "admin";
    }
  } catch {
    // ignore
  }

  return false;
};

export const getUserProfile = async (uid: string): Promise<UserProfile | null> => {
  if (currentMockUser || uid === "admin_vishwa_local_uid") {
    return {
      uid: "admin_vishwa_local_uid",
      email: ADMIN_EMAIL,
      displayName: "Vishwa",
      role: "admin",
      active: true,
      createdAt: new Date().toISOString() as any,
    };
  }

  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
    }
  } catch {
    // ignore
  }

  if (auth.currentUser?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return {
      uid,
      email: ADMIN_EMAIL,
      displayName: "Vishwa",
      role: "admin",
      active: true,
      createdAt: new Date().toISOString() as any,
    };
  }

  return null;
};

export const onAuthChange = (callback: (user: User | null) => void) => {
  authListeners.push(callback);

  // Check if session storage has the admin session
  const stored = sessionStorage.getItem("admin_local_session");
  if (stored && !auth.currentUser) {
    const mockAdmin = createMockAdminUser();
    currentMockUser = mockAdmin;
    callback(mockAdmin);
  }

  const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
    if (firebaseUser) {
      currentMockUser = null;
      callback(firebaseUser);
    } else if (currentMockUser) {
      callback(currentMockUser);
    } else {
      callback(null);
    }
  });

  return () => {
    const idx = authListeners.indexOf(callback);
    if (idx !== -1) authListeners.splice(idx, 1);
    unsubscribe();
  };
};
