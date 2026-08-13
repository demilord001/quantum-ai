import { Loader2 } from "lucide-react";

export function SearchStatus() {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-400">
      <Loader2 className="h-4 w-4 animate-spin" />
      Quantum is searching the web...
    </div>
  );
}