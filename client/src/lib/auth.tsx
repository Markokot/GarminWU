import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { User } from "@shared/schema";
import { queryClient, getQueryFn } from "@/lib/queryClient";

interface AuthContextType {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
  updateUser: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data) {
          setUser(data);
          queryClient.removeQueries({ queryKey: ["/api/workouts"] });
          queryClient.prefetchQuery({ queryKey: ["/api/workouts"], queryFn: getQueryFn({ on401: "throw" }) });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback((user: User) => {
    setUser(user);
    queryClient.removeQueries({ queryKey: ["/api/workouts"] });
    queryClient.prefetchQuery({ queryKey: ["/api/workouts"], queryFn: getQueryFn({ on401: "throw" }) });
  }, []);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST", credentials: "include" }).then(() => {
      setUser(null);
      queryClient.removeQueries({ queryKey: ["/api/workouts"] });
    });
  }, []);

  const updateUser = useCallback((updatedUser: User) => {
    setUser(updatedUser);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
