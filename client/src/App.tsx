import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Findings from "./pages/Findings";
import Methodology from "./pages/Methodology";
import Contact from "./pages/Contact";
import Dashboard from "./pages/Dashboard";
import VerificationDashboard from "./pages/VerificationDashboard";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deep-space">
      <Navbar />
      <main className="pt-16 lg:pt-[72px]">
        {children}
      </main>
      <Footer />
    </div>
  );
}
function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path="/" component={() => <Layout><Home /></Layout>} />
      <Route path="/findings" component={() => <Layout><Findings /></Layout>} />
      <Route path="/dashboard" component={() => <Layout><Dashboard /></Layout>} />
      <Route path="/methodology" component={() => <Layout><Methodology /></Layout>} />
      <Route path="/contact" component={() => <Layout><Contact /></Layout>} />
      <Route path="/verification-dashboard" component={() => <Layout><VerificationDashboard /></Layout>} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
