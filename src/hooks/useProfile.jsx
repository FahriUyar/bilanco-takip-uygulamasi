/**
 * useProfile Hook + ProfileProvider
 *
 * Neden bu Context?
 * Kullanıcının `profiles` tablosundaki app_name ve salary_day bilgisini
 * her sayfada ayrı ayrı DB'den çekmek yerine, giriş anında
 * bir kez okuyup Context'e koyuyoruz. Böylece Header, Dashboard ve
 * diğer bileşenler doğrudan bellek içi state'i kullanır.
 *
 * needsOnboarding = true → kullanıcı henüz profil bilgilerini girmemiş,
 * OnboardingForm gösterilir.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "./useAuth";

const ProfileContext = createContext({});

export function ProfileProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [appName, setAppName] = useState(null);
  const [salaryDay, setSalaryDay] = useState(1);
  const [accountType, setAccountType] = useState("personal");
  const [profileLoading, setProfileLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // Giriş anında profili çek
  useEffect(() => {
    if (!userId) {
      setAppName(null);
      setSalaryDay(1);
      setAccountType("personal");
      setProfileLoading(false);
      setNeedsOnboarding(false);
      return;
    }

    let mounted = true;

    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("app_name, salary_day, account_type, is_onboarded")
          .eq("id", userId)
          .maybeSingle();

        if (!mounted) return;

        if (error) {
          console.error("Profil yükleme hatası:", error);
          setNeedsOnboarding(true);
        } else if (!data || data.is_onboarded === false) {
          // If profile doesn't exist, or is_onboarded is explicitly false (or null)
          setAppName(data?.app_name || null);
          setSalaryDay(data?.salary_day ?? 1);
          setAccountType(data?.account_type || "personal");
          setNeedsOnboarding(true);
        } else {
          setAppName(data.app_name);
          setSalaryDay(data.salary_day ?? 1);
          setAccountType(data.account_type || "personal");
          setNeedsOnboarding(false);
        }
      } catch (err) {
        console.error("Profil çekme hatası:", err);
        if (mounted) setNeedsOnboarding(true);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    };

    fetchProfile();

    return () => {
      mounted = false;
    };
  }, [userId]);

  /**
   * Profil bilgilerini kaydeder (upsert).
   * Hem onboarding hem ayarlar sayfasından çağrılır.
   */
  const saveProfile = useCallback(
    async ({ appName: name, salaryDay: day, accountType: type, isOnboarded }) => {
      if (!userId) return;

      const payload = { id: userId };
      if (name !== undefined) payload.app_name = name.trim();
      if (day !== undefined) payload.salary_day = Number(day);
      if (type !== undefined) payload.account_type = type;
      if (isOnboarded !== undefined) payload.is_onboarded = isOnboarded;

      const { error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });

      if (error) throw error;

      if (name !== undefined) setAppName(name.trim());
      if (day !== undefined) setSalaryDay(Number(day));
      if (type !== undefined) setAccountType(type);
      if (isOnboarded) setNeedsOnboarding(false);
    },
    [userId],
  );

  return (
    <ProfileContext.Provider
      value={{
        appName,
        salaryDay,
        accountType,
        profileLoading,
        needsOnboarding,
        saveProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error("useProfile must be used within a ProfileProvider");
  }
  return context;
}
