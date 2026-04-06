import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { appRouter } from "./routes/AppRoutes";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

// The app shell wires together theme, mocked auth, shared productivity data,
// and the router so every page gets the same providers.
export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthProvider>
        <DataProvider>
          <RouterProvider router={appRouter} />
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
