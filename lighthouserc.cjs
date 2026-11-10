const port = process.env.LHCI_PORT ?? "3200";

module.exports = {
    ci: {
        collect: {
            url: [`http://127.0.0.1:${port}/`],
            numberOfRuns: 3,
            startServerCommand: `npx next start -p ${port}`,
            startServerReadyPattern: "Ready",
            settings: { chromeFlags: "--no-sandbox" },
        },
        assert: {
            assertions: {
                "categories:performance": ["error", { minScore: 0.9 }],
                "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
                // Landing route JavaScript before load, transferred (gzip), in bytes.
                "resource-summary:script:size": ["error", { maxNumericValue: 250000 }],
            },
        },
        upload: { target: "filesystem", outputDir: ".lighthouseci" },
    },
};
