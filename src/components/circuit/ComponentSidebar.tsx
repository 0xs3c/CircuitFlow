import { useState } from "react";
import { componentLibrary, categories } from "@/data/componentLibrary";
import { ComponentDefinition } from "@/types/circuit";
import { Search } from "lucide-react";
import { clsx } from "clsx";
import { useDnD } from "@/context/DnDContext";

export default function ComponentSidebar() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { setDraggedDefinition, setIsDragging } = useDnD();

  const filtered = componentLibrary.filter((c) => {
    const matchesSearch =
      search === "" ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.tags.some((t) => t.includes(search.toLowerCase()));
    const matchesCategory =
      activeCategory === null || c.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const onMouseDown = (e: React.MouseEvent, definition: ComponentDefinition) => {
    e.preventDefault();
    console.log("MOUSE DOWN on:", definition.name);
    setDraggedDefinition(definition);
    setIsDragging(true);
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full">
      {/* Search */}
      <div className="p-3 border-b border-slate-700">
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-1.5 pl-8 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="p-2 border-b border-slate-700 flex flex-wrap gap-1">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx(
            "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
            activeCategory === null
              ? "bg-blue-600 text-white"
              : "bg-slate-800 text-slate-400 hover:text-slate-200"
          )}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() =>
              setActiveCategory(cat === activeCategory ? null : cat)
            }
            className={clsx(
              "px-2 py-0.5 rounded text-[10px] font-medium transition-colors",
              activeCategory === cat
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {filtered.length === 0 && (
          <p className="text-xs text-slate-600 text-center mt-4">
            No components found
          </p>
        )}
        {filtered.map((comp) => (
          <div
            key={comp.id}
            onMouseDown={(e) => onMouseDown(e, comp)}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-sm text-slate-300 cursor-grab active:cursor-grabbing transition-colors border border-slate-700 hover:border-blue-500 select-none"
          >
            <div className="font-medium text-xs truncate">{comp.name}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">
              {comp.category} · {comp.pins.length} pins
            </div>
          </div>
        ))}
      </div>

      {/* Count */}
      <div className="p-2 border-t border-slate-700 text-[10px] text-slate-600 text-center">
        {filtered.length} of {componentLibrary.length} components
      </div>
    </aside>
  );
}