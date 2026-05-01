import { createContext } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "superadmin" | "architect" | "client";
  avatar: string;
  phone?: string;
  postalAddress?: string;
  physicalAddress?: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
  viewRole: "team" | "client";
}

export interface AuthContextType extends AuthState {
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setViewRole: (role: "team" | "client") => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
