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
  return <AuthContext.Provider value={{ session: null }}>{children}</AuthContext.Provider>;
}

export function useAuthSession(): AuthContextValue {
  return useContext(AuthContext);
}
