/**
 * @file Defines feature-level web application code for the contract tracker.
 */
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

/**
 * @description Renders the auth provider component for the contract tracker UI.
 * @param {PropsWithChildren} { children } - Input value for { children }.
 * @returns {JSX.Element} Result of the auth provider operation.
 */
export function AuthProvider({ children }: PropsWithChildren) {
  const userId = import.meta.env.VITE_DEV_USER_ID;
  const session =
    typeof userId === "string" && userId.length > 0
      ? ({ userId, role: "REVIEWER" } as const)
      : null;

  return <AuthContext.Provider value={{ session }}>{children}</AuthContext.Provider>;
}

/**
 * @description Provides the use auth session hook for React data access or state coordination.
 * @returns {AuthContextValue} Result of the use auth session operation.
 */
export function useAuthSession(): AuthContextValue {
  return useContext(AuthContext);
}
