import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Pin, PlacedComponent } from "@/types/circuit";
import { clsx } from "clsx";

const pinTypeColor: Record<Pin["type"], string> = {
  power_in: "#ef4444",
  power_out: "#f97316",
  input: "#3b82f6",
  output: "#22c55e",
  bidirectional: "#a855f7",
  passive: "#94a3b8",
};

const categoryColor: Record<string, string> = {
  MCU: "#1d4ed8",
  Sensors: "#065f46",
  GPS: "#713f12",
  ESC: "#7c2d12",
  Power: "#4a1d96",
  Communication: "#0f766e",
};

const PIN_HEIGHT = 24;
const HEADER_HEIGHT = 44;
const V_PADDING = 8;
const CHAR_WIDTH = 6.5;
const MIN_COL_WIDTH = 60;
const CENTER_GAP = 20;
const H_PADDING = 20;
const BOTTOM_SECTION_HEIGHT_PER_CHAR = 6.5;
const BOTTOM_MIN_HEIGHT = 60;
const BOTTOM_EXTRA = 24;

function getColWidth(pins: Pin[]): number {
  if (pins.length === 0) return MIN_COL_WIDTH;
  const longest = Math.max(...pins.map((p) => p.name.length));
  return Math.max(MIN_COL_WIDTH, longest * CHAR_WIDTH + H_PADDING);
}

function getBottomHeight(pins: Pin[]): number {
  if (pins.length === 0) return 0;
  const longest = Math.max(...pins.map((p) => p.name.length));
  return Math.max(BOTTOM_MIN_HEIGHT, longest * BOTTOM_SECTION_HEIGHT_PER_CHAR + BOTTOM_EXTRA);
}

function ComponentNode({ data, selected }: NodeProps) {
  const component = data.component as PlacedComponent;
  const { definition } = component;

  const leftPins = definition.pins
    .filter((p) => p.side === "left")
    .sort((a, b) => a.position - b.position);

  const rightPins = definition.pins
    .filter((p) => p.side === "right")
    .sort((a, b) => a.position - b.position);

  const bottomPins = definition.pins
    .filter((p) => p.side === "bottom")
    .sort((a, b) => a.position - b.position);

  const leftColWidth = getColWidth(leftPins);
  const rightColWidth = getColWidth(rightPins);
  const totalWidth = leftColWidth + CENTER_GAP + rightColWidth;
  const maxRows = Math.max(leftPins.length, rightPins.length, 1);
  const bodyHeight = maxRows * PIN_HEIGHT + V_PADDING * 2;
  const bottomHeight = getBottomHeight(bottomPins);
  const totalHeight = HEADER_HEIGHT + bodyHeight + bottomHeight;
  const headerColor = categoryColor[definition.category] ?? "#1e293b";

  return (
    <div
      className={clsx(
        "rounded border-2 bg-slate-800 shadow-xl transition-colors select-none relative overflow-visible",
        selected ? "border-blue-400" : "border-slate-600"
      )}
      style={{ width: totalWidth, height: totalHeight }}
    >
      {/* Header */}
      <div
        className="absolute top-0 left-0 right-0 px-3 py-2 rounded-t text-white"
        style={{ backgroundColor: headerColor, height: HEADER_HEIGHT }}
      >
        <div className="text-xs font-bold truncate leading-tight">{definition.name}</div>
        <div className="text-[10px] opacity-70 leading-tight">
          {definition.category}{definition.manufacturer ? ` · ${definition.manufacturer}` : ""}
        </div>
      </div>

      {/* Center divider */}
      {leftPins.length > 0 && rightPins.length > 0 && (
        <div
          className="absolute bg-slate-600"
          style={{
            left: leftColWidth + CENTER_GAP / 2,
            top: HEADER_HEIGHT + V_PADDING,
            width: 1,
            height: bodyHeight - V_PADDING,
          }}
        />
      )}

      {/* Left pins — handles are absolutely positioned relative to the node */}
      {leftPins.map((pin, index) => {
        const top = HEADER_HEIGHT + V_PADDING + index * PIN_HEIGHT + PIN_HEIGHT / 2;
        return (
          <div key={pin.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={pin.id}
              style={{
                background: pinTypeColor[pin.type],
                width: 10,
                height: 10,
                border: "2px solid #0f172a",
                top,
                left: 0,
                transform: "translate(-50%, -50%)",
              }}
              title={`${pin.name} (${pin.type})`}
            />
            {/* Label */}
            <div
              className="absolute flex items-center pointer-events-none"
              style={{
                top: top - PIN_HEIGHT / 2,
                left: 8,
                height: PIN_HEIGHT,
                maxWidth: leftColWidth - 12,
              }}
            >
              <span
                className="font-mono text-slate-300 leading-none truncate"
                style={{ fontSize: 10 }}
              >
                {pin.name}
              </span>
            </div>
          </div>
        );
      })}

      {/* Right pins */}
      {rightPins.map((pin, index) => {
        const top = HEADER_HEIGHT + V_PADDING + index * PIN_HEIGHT + PIN_HEIGHT / 2;
        return (
          <div key={pin.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={pin.id}
              style={{
                background: pinTypeColor[pin.type],
                width: 10,
                height: 10,
                border: "2px solid #0f172a",
                top,
                right: 0,
                transform: "translate(50%, -50%)",
              }}
              title={`${pin.name} (${pin.type})`}
            />
            {/* Label */}
            <div
              className="absolute flex items-center justify-end pointer-events-none"
              style={{
                top: top - PIN_HEIGHT / 2,
                right: 8,
                height: PIN_HEIGHT,
                maxWidth: rightColWidth - 12,
              }}
            >
              <span
                className="font-mono text-slate-300 leading-none truncate"
                style={{ fontSize: 10 }}
              >
                {pin.name}
              </span>
            </div>
          </div>
        );
      })}

      {/* Bottom section separator */}
      {bottomPins.length > 0 && (
        <div
          className="absolute left-0 right-0 bg-slate-600"
          style={{ top: HEADER_HEIGHT + bodyHeight, height: 1 }}
        />
      )}

      {/* Bottom pins */}
      {bottomPins.map((pin, index) => {
        const sectionTop = HEADER_HEIGHT + bodyHeight + 1;
        const pinSpacing = totalWidth / (bottomPins.length + 1);
        const left = pinSpacing * (index + 1);
        const bottom = 0;

        return (
          <div key={pin.id}>
            <Handle
              type="source"
              position={Position.Bottom}
              id={pin.id}
              style={{
                background: pinTypeColor[pin.type],
                width: 10,
                height: 10,
                border: "2px solid #0f172a",
                left,
                bottom,
                top: "auto",
                transform: "translate(-50%, 50%)",
              }}
              title={`${pin.name} (${pin.type})`}
            />
            {/* Vertical label */}
            <div
              className="absolute flex items-end justify-center pointer-events-none"
              style={{
                top: sectionTop + 4,
                left: left - 10,
                width: 20,
                height: bottomHeight - 16,
              }}
            >
              <span
                className="font-mono text-slate-300"
                style={{
                  fontSize: 9,
                  writingMode: "vertical-lr",
                  transform: "rotate(180deg)",
                  whiteSpace: "nowrap",
                }}
              >
                {pin.name}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default memo(ComponentNode);