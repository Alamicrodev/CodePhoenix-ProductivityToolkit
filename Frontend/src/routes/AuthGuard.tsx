import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

// Route guard keeps the private pages hidden until a user exists.
export function AuthGuard() {
  const { user, isLoading } = useAuth();   //useAuth gets auth context.
  const location = useLocation();          //where the user was actually trying to go.

  //if loading we show loading 
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  //if no user exists, then we redirect to login page :)
  //we carry the attempted location in router state so LoginPage can send the user
  //back there after signing in — otherwise shared links (eg /cowork/:slug) would
  //always dump people on the dashboard instead of the room they were invited to.
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;  //return the child (depending on path)
}

export default AuthGuard;

