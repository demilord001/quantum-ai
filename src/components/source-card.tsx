import { ExternalLink } from "lucide-react";

interface SourceCardProps {
  title: string;
  url: string;
}

export function SourceCard({
  title,
  url,
}: SourceCardProps) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-xl border border-white/10 bg-white/[0.03] p-4 transition hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-4">

        <div>
          <p className="font-medium">
            {title}
          </p>

          <p className="mt-2 truncate text-sm text-slate-500">
            {url}
          </p>
        </div>

        <ExternalLink className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:text-white" />
      </div>
    </a>
  );
}