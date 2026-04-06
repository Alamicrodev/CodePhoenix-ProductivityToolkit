import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  clearStoredMockUser,
  createMockUser,
  getStoredMockUser,
  persistMockUser,
} from "../utils/mockAuth";

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// This provider intentionally mocks auth so the UI can demonstrate the full
// login/register flow before a backend service is added.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Restore the locally persisted mock user on refresh.
    const storedUser = getStoredMockUser();
    if (storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    // Simulate a network request so the UI behaves like a real auth form.
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = createMockUser(email);
    setUser(user);
    persistMockUser(user);
  };

  const register = async (email: string, password: string, name: string) => {
    // Register uses the same mocked storage, but lets the user pick a display name.
    await new Promise(resolve => setTimeout(resolve, 500));

    const user = createMockUser(email, name);
    setUser(user);
    persistMockUser(user);
  };

  const logout = () => {
    setUser(null);
    clearStoredMockUser();
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isLoading }}>
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

