import { Navigate, Outlet } from "react-router";
import { useAuth } from "../context/AuthContext";

// Route guard keeps the private pages hidden until a user exists.
export function AuthGuard() {
  const { user, isLoading } = useAuth();   //useAuth gets auth context. 

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
  if (!user) {
    return <Navigate to="/login" replace />;
  }



  return <Outlet />;  //return the child (depending on path)
}

export default AuthGuard;

