import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { apiRequest } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const ACCESS_TOKEN_STORAGE_KEY = "accessToken";

interface LoginResponse {
  access_token: string;
  token_type: string;
}

interface ApiUser {
  id: string;
  email: string;
  full_name: string;
}

function mapUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.full_name,
  };
}

function getStoredAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
}

function persistAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token);
}

function clearStoredAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const restoreSession = async () => {
      const storedAccessToken = getStoredAccessToken();

      if (!storedAccessToken) {
        setIsLoading(false);
        return;
      }

      try {
        const currentUser = await apiRequest<ApiUser>("/auth/me", {
          token: storedAccessToken,
        });

        setAccessToken(storedAccessToken);
        setUser(mapUser(currentUser));
      } catch (error) {
        console.error("Failed to restore session:", error);
        clearStoredAccessToken();
        setAccessToken(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const session = await apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    const currentUser = await apiRequest<ApiUser>("/auth/me", {
      token: session.access_token,
    });

    persistAccessToken(session.access_token);
    setAccessToken(session.access_token);
    setUser(mapUser(currentUser));
  };

  const register = async (email: string, password: string, name: string) => {
    await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        full_name: name,
      }),
    });

    await login(email, password);
  };

  const logout = () => {
    setUser(null);
    setAccessToken(null);
    clearStoredAccessToken();
  };

  const value = useMemo(
    () => ({ user, accessToken, login, register, logout, isLoading }),
    [accessToken, isLoading, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
