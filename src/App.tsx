import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "./store/useAuth";
import { useStore } from "./store/useStore";
import { useTheme } from "./hooks/useTheme";
import { AppLayout } from "./components/Layout/AppLayout";
import { Toasts } from "./components/common/Toasts";
import { LoginPage } from "./pages/LoginPage";
import { AccountsPage } from "./pages/AccountsPage";
import { ConfirmationsPage } from "./pages/ConfirmationsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const status = useAuth((s) => s.status);
  const initAuth = useAuth((s) => s.init);
  const loadAccounts = useStore((s) => s.loadAccounts);

  useTheme();

  useEffect(() => {
    void initAuth();
  }, [initAuth]);

  useEffect(() => {
    if (status === "authed") void loadAccounts();
  }, [status, loadAccounts]);

  if (status === "loading") {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex flex-col items-center gap-3 text-ink-muted">
          <div className="grid h-12 w-12 animate-pulse place-items-center rounded-2xl bg-accent text-white">
            <ShieldCheck size={26} />
          </div>
          <span className="text-sm">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {status === "authed" ? (
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/accounts" replace />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/confirmations" element={<ConfirmationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/accounts" replace />} />
          </Routes>
        </AppLayout>
      ) : (
        <LoginPage />
      )}
      <Toasts />
    </>
  );
}
