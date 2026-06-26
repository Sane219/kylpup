import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, getToken, setToken } from "./api";

type User = { user_id: string; org_id: string; role: "admin" | "analyst" };
type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (b: { email: string; password: string; org_name?: string; invite_code?: string }) => Promise<any>;
  logout: () => void;
};

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) return setLoading(false);
    api<User>("/auth/me").then(setUser).catch(() => setToken(null)).finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { access_token } = await api<{ access_token: string }>("/auth/login", {
      method: "POST", body: JSON.stringify({ email, password }),
    });
    setToken(access_token);
    setUser(await api<User>("/auth/me"));
  };

  const signup: AuthCtx["signup"] = async (b) => {
    const res = await api("/auth/signup", { method: "POST", body: JSON.stringify(b) });
    await login(b.email, b.password);
    return res;
  };

  const logout = () => {
    api("/auth/logout", { method: "POST" }).catch(() => {});
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, login, signup, logout }}>{children}</Ctx.Provider>;
}
