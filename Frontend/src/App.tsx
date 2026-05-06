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
    // Themeprovider is simply a nextJS module that adds a class .dark/.light to the <html> element.
    // in css classes (.dark/.forest etc), we define custom theme variables that are used throughout our css.  
    // 
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {/* Auth provider will provide auth data all over the app */}
      <AuthProvider>
        <DataProvider>

          {/* For routes */}
          <RouterProvider router={appRouter} />

          {/* from Sonner toast library */}
          <Toaster />
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
