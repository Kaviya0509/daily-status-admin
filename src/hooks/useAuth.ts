import { useState, useEffect } from "react";
import type { User } from "firebase/auth";
import { onAuthChange, checkIsAdmin, getUserProfile } from "@/services/authService";
import type { UserProfile } from "@/types";

interface AuthState {
  user: User | null;
  userProfile: UserProfile | null;
  isAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const adminStatus = await checkIsAdmin(firebaseUser);
          setIsAdmin(adminStatus);
          const profile = await getUserProfile(firebaseUser.uid);
          setUserProfile(profile);
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAdmin(false);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setIsAdmin(false);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, userProfile, isAdmin, loading };
}
