import { Info } from "lucide-react";

export function DemoBanner() {
    return (
        <p className="mb-6 flex items-start gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm text-secondary">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-brand" />
            <span>
                <strong className="font-semibold">Demo mode.</strong> No model API key is set on this server, so every review replays a saved sample review of a
                sample pull request. No tokens are spent.
            </span>
        </p>
    );
}
