import { ReviewApp } from "@/components/review-app";
import { serverConfig } from "@/lib/config";

// Demo mode depends on whether ANTHROPIC_API_KEY is set at runtime, so render per request.
export const dynamic = "force-dynamic";

export default function Page() {
    const config = serverConfig();
    return <ReviewApp demo={!config.apiKey} defaultModel={config.defaultModel} />;
}
