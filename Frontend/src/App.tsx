import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "./context/AuthContext";
import { DataProvider } from "./context/DataContext";
import { PaletteProvider } from "./context/PaletteContext";
import { appRouter } from "./routes/AppRoutes";
import { Toaster } from "./components/ui/sonner";
import "./App.css";

// The app shell wires together theme, API-backed auth, shared productivity data,
// and the router so every page gets the same providers.
// The app shell is the root of the app, and is rendered in index.tsx. !
export default function App() {
  return (
    // Themeprovider is simply a nextJS module that adds a class .dark/.light to the <html> element.
    // in css classes (.dark/.forest etc), we define custom theme variables that are used throughout our css.  
    // 
    // defaultTheme is light per both handoff READMEs; enableSystem means any
    // theme control must read resolvedTheme, never theme.
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      {/* Auth provider will provide auth data all over the app */}
      <AuthProvider>
        <DataProvider>
          {/* Holds the ⌘K palette state so the shell can own the shortcut */}
          <PaletteProvider>
            {/* For routes */}
            <RouterProvider router={appRouter} />
          </PaletteProvider>

          {/* from Sonner toast library — 2400ms per the handoff, not the 4s default */}
          <Toaster duration={2400} />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
