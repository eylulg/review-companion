import { InfoCircle } from "@untitledui/icons";

export function DemoBanner() {
    return (
        <div className="border-t border-secondary bg-secondary">
            <p className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm text-secondary md:px-6">
                <InfoCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-brand-primary" />
                <span>
                    <strong className="font-semibold">Demo mode.</strong> No model API key is set on this server, so every review replays a saved sample review
                    of a sample pull request. No tokens are spent.
                </span>
            </p>
        </div>
    );
}
