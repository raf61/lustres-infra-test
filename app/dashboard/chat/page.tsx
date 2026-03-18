import { ChatPanel } from "@/components/chat";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

export default function ChatPage() {
  return (
    <DashboardLayout hideHeader={true}>
      <div className="h-screen">
        <ChatPanel />
      </div>
    </DashboardLayout>
  );
}

