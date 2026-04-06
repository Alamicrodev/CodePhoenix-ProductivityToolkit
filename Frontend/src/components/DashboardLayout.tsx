import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import {
  LayoutDashboard,
  CheckSquare,
  Target,
  Timer,
  Calendar,
  User,
  LogOut,
  Menu,
  Sparkles,
} from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Tasks", href: "/tasks", icon: CheckSquare },
  { name: "Habits", href: "/habits", icon: Target },
  { name: "Focus", href: "/focus", icon: Timer },
  { name: "Schedule", href: "/schedule", icon: Calendar },
  { name: "Profile", href: "/profile", icon: User },
];

export default function DashboardLayout({ children }: LayoutProps) {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    setIsMobileNavOpen(false);
    navigate("/login");
  };

  const sidebarContent = (isMobile = false) => (
    <div className="flex h-full flex-col">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="font-semibold">FlowManager</h2>
            <p className="text-xs text-muted-foreground">AI Productivity</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;
          const linkClasses = `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
            isActive
              ? "bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`;

          if (isMobile) {
            return (
              <SheetClose asChild key={item.name}>
                <Link to={item.href} className={linkClasses}>
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              </SheetClose>
            );
          }

          return (
            <Link key={item.name} to={item.href} className={linkClasses}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-4">
        <div className="flex items-center justify-between px-4">
          <span className="text-sm text-muted-foreground">Theme</span>
          <ThemeToggle />
        </div>
        <div className="px-4 py-2 rounded-lg bg-accent">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
          <span>Log out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden w-64 border-r border-border bg-card md:flex md:flex-col">
        {sidebarContent()}
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Open navigation menu">
                    <Menu className="w-5 h-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[20rem] p-0">
                  <SheetHeader className="sr-only">
                    <SheetTitle>Navigation Menu</SheetTitle>
                    <SheetDescription>Browse pages and account actions.</SheetDescription>
                  </SheetHeader>
                  {sidebarContent(true)}
                </SheetContent>
              </Sheet>
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-600 dark:bg-blue-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold leading-none">FlowManager</p>
                  <p className="text-xs text-muted-foreground">AI Productivity</p>
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
        {children}
      </main>
    </div>
  );
}

