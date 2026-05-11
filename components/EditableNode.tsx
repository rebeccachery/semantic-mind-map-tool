"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useState } from "react";
import { useLabelChange } from "./MindMap";

export type EditableNodeData = {
  label: string;
  isRoot?: boolean;
};

export default function EditableNode({
  id,
  data,
  selected,
}: NodeProps & { data: EditableNodeData }) {
  const [editing, setEditing] = useState(false);
  const onLabelChange = useLabelChange();

  function commit(value: string) {
    const next = value.trim();
    if (next && next !== data.label) {
      onLabelChange(id, next);
    }
    setEditing(false);
  }

  const baseClasses = data.isRoot
    ? "bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white"
    : "bg-white text-zinc-900 border-zinc-300 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-700";

  const ringClasses = selected
    ? "ring-2 ring-blue-500 ring-offset-1 ring-offset-transparent"
    : "";

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      className={`min-w-[120px] max-w-[220px] rounded-2xl border px-3 py-2 text-sm font-medium shadow-sm transition ${baseClasses} ${ringClasses}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-zinc-400"
      />
      {editing ? (
        <input
          autoFocus
          defaultValue={data.label}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(e.currentTarget.value);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setEditing(false);
            }
            e.stopPropagation();
          }}
          className="w-full bg-transparent text-center outline-none"
        />
      ) : (
        <div className="text-center leading-snug select-none">{data.label}</div>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-zinc-400"
      />
    </div>
  );
}
