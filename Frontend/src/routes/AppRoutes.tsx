import { createBrowserRouter } from "react-router";
import AuthGuard from "../components/AuthGuard";
import DashboardPage from "../pages/DashboardPage";
import FocusPage from "../pages/FocusPage";
import HabitsPage from "../pages/HabitsPage";
import LoginPage from "../pages/LoginPage";
import ProfilePage from "../pages/ProfilePage";
import RegisterPage from "../pages/RegisterPage";
import SchedulePage from "../pages/SchedulePage";
import TasksPage from "../pages/TasksPage";

// Central routing keeps page-level navigation easy to scan in one place.
export const appRouter = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/register",
    element: <RegisterPage />,
  },
  {
    path: "/",
    element: <AuthGuard />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "tasks", element: <TasksPage /> },
      { path: "habits", element: <HabitsPage /> },
      { path: "focus", element: <FocusPage /> },
      { path: "schedule", element: <SchedulePage /> },
      { path: "profile", element: <ProfilePage /> },
    ],
  },
]);
