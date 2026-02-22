import { useState, useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import { useProjectStore } from "@/store/projectStore";
import AuthScreen from "@/screens/AuthScreen";
import ProjectDashboard from "@/screens/ProjectDashboard";
import CircuitPanel from "@/panels/CircuitPanel";
import LogicPanel from "@/panels/LogicPanel";
import SimulatePanel from "@/panels/SimulatePanel";
import CodePanel from "@/panels/CodePanel";
import StatusBar from "@/components/StatusBar";
import TopNav from "@/components/TopNav";
import { Loader2 } from "lucide-react";

export type Panel = "circuit" | "logic" | "simulate" | "code";

function LoadingScreen() {
  return (
    <div className="h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 size={32} className="text-blue-500 animate-spin" />
        <p className="text-slate-500 text-sm">Loading CircuitFlow...</p>
      </div>
    </div>
  );
}

function MainApp() {
  const [activePanel, setActivePanel] = useState<Panel>("circuit");
  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <TopNav activePanel={activePanel} setActivePanel={setActivePanel} />
      <main className="flex-1 overflow-hidden">
        {activePanel === "circuit" && <CircuitPanel />}
        {activePanel === "logic" && <LogicPanel />}
        {activePanel === "simulate" && <SimulatePanel />}
        {activePanel === "code" && <CodePanel />}
      </main>
      <StatusBar activePanel={activePanel} />
    </div>
  );
}

export default function App() {
  const { user, initialized, initialize } = useAuthStore();
  const { currentProject } = useProjectStore();

  useEffect(() => {
    initialize();
  }, []);

  if (!initialized) return <LoadingScreen />;
  if (!user) return <AuthScreen />;
  if (!currentProject) return <ProjectDashboard />;
  return <MainApp />;
}