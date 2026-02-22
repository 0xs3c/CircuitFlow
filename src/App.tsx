import { useState } from "react";
import CircuitPanel from "@/panels/CircuitPanel";
import LogicPanel from "@/panels/LogicPanel";
import SimulatePanel from "@/panels/SimulatePanel";
import CodePanel from "@/panels/CodePanel";
import StatusBar from "@/components/StatusBar";
import TopNav from "@/components/TopNav";

export type Panel = "circuit" | "logic" | "simulate" | "code";

function App() {
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

export default App;