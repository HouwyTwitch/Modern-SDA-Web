import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useStore } from "./store/useStore";
import { useTheme } from "./hooks/useTheme";
import { useAutoLock } from "./hooks/useAutoLock";
import { AppLayout } from "./components/Layout/AppLayout";
import { Toasts } from "./components/common/Toasts";
import { LockScreen } from "./components/LockScreen";
import { AccountsPage } from "./pages/AccountsPage";
import { ConfirmationsPage } from "./pages/ConfirmationsPage";
import { SettingsPage } from "./pages/SettingsPage";

export default function App() {
  const init = useStore((s) => s.init);
  const locked = useStore((s) => s.locked);
  const initialized = useStore((s) => s.initialized);

  useTheme();
  useAutoLock();

  useEffect(() => {
    init();
  }, [init]);

  if (!initialized) return null;

  return (
    <>
      {locked ? (
        <LockScreen />
      ) : (
        <AppLayout>
          <Routes>
            <Route path="/" element={<Navigate to="/accounts" replace />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/confirmations" element={<ConfirmationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/accounts" replace />} />
          </Routes>
        </AppLayout>
      )}
      <Toasts />
    </>
  );
}
