import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Dashboard } from "./pages/Dashboard";
import { NewSearch } from "./pages/NewSearch";
import { SessionDetail } from "./pages/SessionDetail";
import { useTheme } from "./store/theme";

export default function App() {
  const init = useTheme((s) => s.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="search/new" element={<NewSearch />} />
          <Route path="sessions/:id" element={<SessionDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
