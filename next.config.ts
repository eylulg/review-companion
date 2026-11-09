import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    poweredByHeader: false,
    experimental: {
        optimizePackageImports: ["@untitledui/icons"],
    },
};

export default nextConfig;
