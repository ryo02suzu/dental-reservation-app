import { Switch, Route, useParams, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LoginPage from "@/pages/login";
import SetupPage from "@/pages/setup";
import BookingPage from "@/pages/booking";
import MyAppointmentsPage from "@/pages/my-appointments";
import ClinicSignupPage from "@/pages/clinic-signup";
import SuperAdminPage from "@/pages/super-admin";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";
import DemoLoginPage from "@/pages/demo-login";
import StaffLoginPage from "@/pages/staff-login";
import MySchedulePage from "@/pages/my-schedule";
import QrClockInPage from "@/pages/qr-clock-in";
import { Loader2 } from "lucide-react";
import { apiRequest } from "./lib/queryClient";
import { Redirect } from "wouter";

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location]);
  return null;
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();
  const { data: setupStatus, isLoading: isLoadingSetup } = useQuery<{ setupNeeded: boolean }>({
    queryKey: ["/api/auth/setup-needed"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/auth/setup-needed");
      return res.json();
    },
  });

  if (isLoading || isLoadingSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (setupStatus?.setupNeeded) {
    return <Redirect to="/setup" />;
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function BookingPageWithSlug() {
  const params = useParams<{ slug: string }>();
  return <BookingPage slug={params.slug} />;
}

function Router() {
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path="/">{() => <Redirect to="/signup" />}</Route>
        <Route path="/login" component={LoginPage} />
        <Route path="/setup" component={SetupPage} />
        <Route path="/signup" component={ClinicSignupPage} />
        <Route path="/super-admin" component={SuperAdminPage} />
        <Route path="/booking">{() => <BookingPage />}</Route>
        <Route path="/book/:slug">{() => <BookingPageWithSlug />}</Route>
        <Route path="/my-appointments" component={MyAppointmentsPage} />
        <Route path="/admin">
          {() => <ProtectedRoute component={Home} />}
        </Route>
        <Route path="/demo-login" component={DemoLoginPage} />
        <Route path="/staff-login/:token" component={StaffLoginPage} />
        <Route path="/my-schedule" component={MySchedulePage} />
        <Route path="/qr-clock-in/:token" component={QrClockInPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
