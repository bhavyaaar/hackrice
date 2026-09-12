import { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { bootstrap } from "./api";
import { isSupabaseConfigured, supabase } from "./supabase";

type AuthCtx = {
  session: Session | null;
  loading: boolean;
};

const Ctx = createContext<AuthCtx>({ session: null, loading: true });

const SESSION_TIMEOUT_MS = 3500;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured) {
      setSession(null);
      setLoading(false);
      return;
    }

    const finish = () => {
      if (!cancelled) setLoading(false);
    };

    const timeout = setTimeout(finish, SESSION_TIMEOUT_MS);

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setSession(data.session);
      } catch {
        /* SecureStore / getSession can hang or fail in the iOS simulator */
      } finally {
        finish();
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next) {
        void bootstrap().catch(() => {
          /* bootstrap is retried from Home */
        });
      }
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      sub.subscription.unsubscribe();
    };
  }, []);

  return <Ctx.Provider value={{ session, loading }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
