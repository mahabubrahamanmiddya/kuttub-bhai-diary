"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase/client";
import { Business, Profile } from "@/types/database";
import { dataService } from "@/lib/data-service";

interface User {
  id: string;
  email?: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  business: Business | null;
  isLoading: boolean;
  isCloudConnected: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (data: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    phone?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
  refreshBusiness: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isCloudConnected = isSupabaseConfigured;

  useEffect(() => {
    async function initAuth() {
      try {
        if (isSupabaseConfigured && supabase) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            setUser({
              id: session.user.id,
              email: session.user.email,
              name: session.user.user_metadata?.name,
            });

            const biz = await dataService.getBusiness();
            setBusiness(biz);
          } else {
            setUser(null);
            setBusiness(null);
          }

          // Listen for auth state changes
          const {
            data: { subscription },
          } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
            if (currentSession?.user) {
              setUser({
                id: currentSession.user.id,
                email: currentSession.user.email,
                name: currentSession.user.user_metadata?.name,
              });
              const biz = await dataService.getBusiness();
              setBusiness(biz);
            } else {
              setUser(null);
              setBusiness(null);
            }
          });

          return () => subscription.unsubscribe();
        } else {
          // Unconfigured demo mode: persistent local user session
          const savedUser = localStorage.getItem("kuttub_diary_user");
          if (savedUser) {
            try {
              const u = JSON.parse(savedUser);
              setUser(u);
              const biz = await dataService.getBusiness();
              setBusiness(biz);
            } catch {
              setUser(null);
            }
          } else {
            // Auto-login to default brother's business in offline / demo mode
            const defaultUser = {
              id: "demo-user-1",
              email: "brother@business.in",
              name: "Kuttub Bhai",
            };
            localStorage.setItem("kuttub_diary_user", JSON.stringify(defaultUser));
            setUser(defaultUser);
            const biz = await dataService.getBusiness();
            setBusiness(biz);
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  const refreshBusiness = async () => {
    const biz = await dataService.getBusiness();
    setBusiness(biz);
  };

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) return { success: false, error: error.message };

        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name,
          });
          const biz = await dataService.getBusiness();
          setBusiness(biz);
        }
        return { success: true };
      } else {
        // Local mode login
        const loggedUser = {
          id: "demo-user-" + email.split("@")[0],
          email: email.trim(),
          name: email.split("@")[0],
        };
        localStorage.setItem("kuttub_diary_user", JSON.stringify(loggedUser));
        setUser(loggedUser);
        const biz = await dataService.getBusiness();
        setBusiness(biz);
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Failed to sign in" };
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async ({
    email,
    password,
    name,
    businessName,
    phone,
  }: {
    email: string;
    password: string;
    name: string;
    businessName: string;
    phone?: string;
  }) => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              name: name.trim(),
              business_name: businessName.trim(),
              phone: phone ? phone.trim() : null,
            },
          },
        });

        if (error) return { success: false, error: error.message };

        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            name,
          });
          const biz = await dataService.getBusiness();
          setBusiness(biz);
        }
        return { success: true };
      } else {
        const newUser = {
          id: "user-" + Date.now(),
          email: email.trim(),
          name: name.trim(),
        };
        localStorage.setItem("kuttub_diary_user", JSON.stringify(newUser));
        const newBiz: Business = {
          id: "biz-" + Date.now(),
          owner_id: newUser.id,
          business_name: businessName.trim(),
          phone: phone || null,
          email: email.trim(),
          address: "",
          currency: "INR",
          timezone: "Asia/Kolkata",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await dataService.updateBusiness(newBiz);
        setUser(newUser);
        setBusiness(newBiz);
        return { success: true };
      }
    } catch (err: any) {
      return { success: false, error: err.message || "Signup failed" };
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.auth.signOut();
      }
      localStorage.removeItem("kuttub_diary_user");
      setUser(null);
      setBusiness(null);
    } catch (err) {
      console.error("Signout error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) return { success: false, error: error.message };
      return { success: true };
    }
    return { success: true };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        business,
        isLoading,
        isCloudConnected,
        signIn,
        signUp,
        signOut,
        resetPassword,
        refreshBusiness,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
