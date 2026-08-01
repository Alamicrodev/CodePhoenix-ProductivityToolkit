import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";
import { useDelayedFlag } from "../lib/useDelayedFlag";

// Route guard keeps the private pages hidden until a user exists.
export function AuthGuard() {
  const { user, isLoading } = useAuth();   //useAuth gets auth context.
  const location = useLocation();          //where the user was actually trying to go.
  const showSlowHint = useDelayedFlag(isLoading);

  // This is the first paint on every private route, so it has to stay quiet.
  // "No spinners under 300ms" — below that threshold we render nothing at all,
  // and past it a single muted line rather than a spinning ring.
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        {showSlowHint && <p className="text-xs text-tertiary">Signing you in…</p>}
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

