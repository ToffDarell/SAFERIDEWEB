import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <h1 className="app-page-heading mb-4">404</h1>
        <p className="app-body-text mb-4 text-muted-foreground">Oops! Page not found</p>
        <a href="/" className="text-[13px] font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80">
          Return to Home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
