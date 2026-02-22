import { useState, useEffect, useCallback, useRef } from "react";
import { Search, ChevronDown, Loader2, AlertCircle } from "lucide-react";
import { ComponentDefinition } from "@/types/circuit";
import { fetchComponents, fetchCategories } from "@/lib/componentService";
import { useDnD } from "@/context/DnDContext";
import { clsx } from "clsx";

const LIMIT = 40;

export default function ComponentSidebar() {
  const [search, setSearch]         = useState("");
  const [category, setCategory]     = useState("All");
  const [categories, setCategories] = useState<string[]>([]);
  const [components, setComponents] = useState<ComponentDefinition[]>([]);
  const [total, setTotal]           = useState(0);
  const [offset, setOffset]         = useState(0);
  const [loading, setLoading]       = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [hasMore, setHasMore]       = useState(false);

  const { setDraggedDefinition, setIsDragging } = useDnD();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load categories once on mount
  useEffect(() => {
    fetchCategories().then((cats) => setCategories(["All", ...cats]));
  }, []);

  // Load components when search or category changes (debounced)
  const loadComponents = useCallback(async (
    searchVal: string,
    categoryVal: string,
    newOffset: number,
    append: boolean
  ) => {
    if (newOffset === 0) setLoading(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const result = await fetchComponents({
        search:   searchVal,
        category: categoryVal,
        limit:    LIMIT,
        offset:   newOffset,
      });

      setComponents((prev) =>
        append ? [...prev, ...result.components] : result.components
      );
      setTotal(result.total);
      setHasMore(result.hasMore);
      setOffset(newOffset + LIMIT);
    } catch (err: any) {
      setError(err.message ?? "Failed to load components");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Debounced search + category trigger
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setOffset(0);
      loadComponents(search, category, 0, false);
    }, 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, category, loadComponents]);

  const handleLoadMore = () => {
    loadComponents(search, category, offset, true);
  };

  const handleMouseDown = (def: ComponentDefinition) => {
    setDraggedDefinition(def);
    setIsDragging(true);
  };

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-700 flex flex-col h-full shrink-0">

      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-slate-700">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Components
        </p>

        {/* Search */}
        <div className="relative mb-2">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search 8,000+ components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Category dropdown */}
        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full appearance-none bg-slate-800 border border-slate-700 rounded-md px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <ChevronDown
            size={12}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
          />
        </div>
      </div>

      {/* Results count */}
      <div className="px-3 py-1.5 border-b border-slate-800">
        <p className="text-[10px] text-slate-500">
          {loading ? "Loading..." : `${total.toLocaleString()} components`}
        </p>
      </div>

      {/* Component list */}
      <div className="flex-1 overflow-y-auto">

        {/* Error state */}
        {error && (
          <div className="m-3 p-2.5 bg-red-900/20 border border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle size={13} className="text-red-400 mt-0.5 shrink-0" />
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="text-blue-500 animate-spin" />
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && components.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <p className="text-xs text-slate-500">No components found</p>
            <p className="text-[10px] text-slate-600 mt-1">Try a different search</p>
          </div>
        )}

        {/* Component rows */}
        {!loading && components.map((def) => (
          <div
            key={def.id}
            onMouseDown={() => handleMouseDown(def)}
            className="px-3 py-2 border-b border-slate-800 cursor-grab hover:bg-slate-800 active:bg-slate-700 transition-colors select-none group"
          >
            <div className="flex items-start justify-between gap-1">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-200 truncate leading-tight">
                  {def.name}
                </p>
                {def.description && (
                  <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {def.description}
                  </p>
                )}
              </div>
              <span className={clsx(
                "text-[9px] px-1.5 py-0.5 rounded shrink-0 mt-0.5 font-medium",
                categoryBadgeColor(def.category)
              )}>
                {def.category}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-slate-600">
                {def.pins.length} pins
              </span>
              {def.manufacturer && (
                <span className="text-[10px] text-slate-600 truncate">
                  · {def.manufacturer}
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Load more */}
        {hasMore && !loading && (
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="w-full py-3 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loadingMore ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Loading...
              </>
            ) : (
              `Load more (${total - offset + LIMIT} remaining)`
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

function categoryBadgeColor(category: string): string {
  const map: Record<string, string> = {
    MCU:           "bg-blue-900/60 text-blue-300",
    Sensors:       "bg-emerald-900/60 text-emerald-300",
    GPS:           "bg-yellow-900/60 text-yellow-300",
    Communication: "bg-teal-900/60 text-teal-300",
    Power:         "bg-purple-900/60 text-purple-300",
    Interface:     "bg-cyan-900/60 text-cyan-300",
    Driver:        "bg-orange-900/60 text-orange-300",
    Display:       "bg-pink-900/60 text-pink-300",
    Connector:     "bg-slate-700/60 text-slate-300",
    Logic:         "bg-indigo-900/60 text-indigo-300",
    Passive:       "bg-slate-700/60 text-slate-300",
    Memory:        "bg-rose-900/60 text-rose-300",
    Analog:        "bg-amber-900/60 text-amber-300",
    Discrete:      "bg-lime-900/60 text-lime-300",
    Audio:         "bg-fuchsia-900/60 text-fuchsia-300",
  };
  return map[category] ?? "bg-slate-700/60 text-slate-300";
}