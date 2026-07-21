import { createContext, useContext } from "react";
import type { PropsWithChildren } from "react";

export interface AuthSession {
  readonly userId: string;
  readonly role: "ADMIN" | "REVIEWER";
}

interface AuthContextValue {
  readonly session: AuthSession | null;
}

const AuthContext = createContext<AuthContextValue>({ session: null });

export function AuthProvider({ children }: PropsWithChildren) {
  const userId = import.meta.env.VITE_DEV_USER_ID;
  const session =
    typeof userId === "string" && userId.length > 0
      ? ({ userId, role: "REVIEWER" } as const)
      : null;

  return <AuthContext.Provider value={{ session }}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  return useContext(AuthContext);
}
