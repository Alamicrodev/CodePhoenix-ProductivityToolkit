import { createBrowserRouter, Navigate } from "react-router";
import AuthGuard from "./AuthGuard";
import CoworkPage from "../pages/CoworkPage";
import CoworkRoomPage from "../pages/CoworkRoomPage";
import FocusPage from "../pages/FocusPage";
import HabitDetailPage from "../pages/HabitDetailPage";
import HabitsPage from "../pages/HabitsPage";
import LoginPage from "../pages/LoginPage";
import ProfilePage from "../pages/ProfilePage";
import RegisterPage from "../pages/RegisterPage";
import SchedulePage from "../pages/SchedulePage";
import TasksPage from "../pages/TasksPage";
import LandingPage from "../pages/LandingPage";

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
    element: <LandingPage/>, 
  },
  {
    element: <AuthGuard />,     //AuthGuard essentially wraps arround its children, and only allows access if authenticated.
    children: [
      // The schedule ("Today") is the home page; the old dashboard is gone.
      { path: "/schedule", element: <SchedulePage /> },
      { path: "/tasks", element: <TasksPage /> },
      { path: "/habits", element: <HabitsPage /> },
      { path: "/habits/:habitId", element: <HabitDetailPage /> },
      { path: "/focus", element: <FocusPage /> },
      { path: "/cowork", element: <CoworkPage /> },
      { path: "/cowork/:slug", element: <CoworkRoomPage /> },
      // Old bookmarks and links keep working.
      { path: "/schedule", element: <Navigate to="/" replace /> },
      { path: "/profile", element: <ProfilePage /> },
    ],
  },
]);
