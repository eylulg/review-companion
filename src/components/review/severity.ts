import type { BadgeColors } from "@/components/base/badges/badge-types";
import type { Severity } from "@/lib/types";

export const SEVERITY_COLOR: Record<Severity, BadgeColors> = {
    blocker: "error",
    bug: "orange",
    risk: "blue",
    nit: "gray",
};
