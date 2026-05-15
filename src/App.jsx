import { HashRouter } from "react-router-dom";
import AppRoutes from "./App.tsx";
import { ERPProvider } from "./context/ERPContext";

export default function App() {
  return (
    <HashRouter>
      <ERPProvider>
        <AppRoutes />
      </ERPProvider>
    </HashRouter>
  );
}
