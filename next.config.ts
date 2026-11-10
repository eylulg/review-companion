import type { NextConfig } from "next";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const nextConfig: NextConfig = {
    poweredByHeader: false,
    turbopack: {
        // @eylulg/ui is installed as file:../ui, a symlink outside this folder. Turbopack must be allowed to read
        // it. Once the package comes from npm this can go.
        root: dirname(dirname(fileURLToPath(import.meta.url))),
    },
};

export default nextConfig;
