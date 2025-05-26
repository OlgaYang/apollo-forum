import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
    schema: "./src/schema.graphql",
    generates: {
        "./src/__generated__/types.ts": {
            plugins: ["typescript", "typescript-resolvers"],
        },
    },
    config: {
        useIndexSignature: true,
    },
};

export default config;