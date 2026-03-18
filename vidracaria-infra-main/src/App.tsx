import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "./pages/Login";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ChatCenter from "./pages/ChatCenter";
import SellerAnalytics from "./pages/SellerAnalytics";
import LeadFunnel from "./pages/LeadFunnel";
import ClientDatabase from "./pages/ClientDatabase";
import Campaigns from "./pages/Campaigns";
import CRMKanban from "./pages/CRMKanban";
import AIAnalytics from "./pages/AIAnalytics";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/chat" element={<ChatCenter />} />
            <Route path="/sellers" element={<SellerAnalytics />} />
            <Route path="/kanban" element={<CRMKanban />} />
            <Route path="/funnel" element={<LeadFunnel />} />
            <Route path="/ai-analytics" element={<AIAnalytics />} />
            <Route path="/database" element={<ClientDatabase />} />
            <Route path="/campaigns" element={<Campaigns />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
