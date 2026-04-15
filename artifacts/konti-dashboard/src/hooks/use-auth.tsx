import { useState, useEffect, createContext, useContext } from "react";
import { useLocation } from "wouter";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin" | "architect" | "client";
  avatar: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  viewRole: "team" | "client";
}

interface AuthContextType extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setViewRole: (role: "team" | "client") => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [auth, setAuth] = useState<AuthState>(() => {
    try {
      const stored = localStorage.getItem("konti_auth");
      if (stored) {
        const parsed = JSON.parse(stored) as AuthState;
        return parsed;
      }
    } catch {}
    return { token: null, user: null, viewRole: "team" };
  });

  const login = (token: string, user: AuthUser) => {
    const newAuth: AuthState = {
      token,
      user,
      viewRole: user.role === "client" ? "client" : "team",
    };
    setAuth(newAuth);
    localStorage.setItem("konti_auth", JSON.stringify(newAuth));
  };

  const logout = () => {
    setAuth({ token: null, user: null, viewRole: "team" });
    localStorage.removeItem("konti_auth");
    setLocation("/login");
  };

  const setViewRole = (role: "team" | "client") => {
    setAuth((prev) => {
      const next = { ...prev, viewRole: role };
      localStorage.setItem("konti_auth", JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider
      value={{
        ...auth,
        login,
        logout,
        setViewRole,
        isAuthenticated: !!auth.token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) setLocation("/login");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export function RequireRole({
  roles,
  children,
}: {
  roles: AuthUser["role"][];
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    } else if (user && !roles.includes(user.role)) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, user, roles, setLocation]);

  if (!isAuthenticated) return null;
  if (user && !roles.includes(user.role)) return null;
  return <>{children}</>;
}
