import type { BadgeColor } from "@eylulg/ui/badge";
import type { Severity } from "@/lib/types";

export const SEVERITY_COLOR: Record<Severity, BadgeColor> = {
    blocker: "error",
    bug: "warning",
    risk: "brand",
    nit: "gray",
};
