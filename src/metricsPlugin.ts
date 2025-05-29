import { ApolloServerPlugin } from '@apollo/server';
import { GraphQLError } from 'graphql';
import { Counter, Summary, Registry } from 'prom-client';

const registry = new Registry();


const requestCounter = new Counter({
    name: 'graphql_requests_total',
    help: 'Total number of GraphQL operations',
    labelNames: ['operationType', 'operationName'],
});

const requestDurationSummary = new Summary({
    name: 'graphql_request_duration_seconds',
    help: 'Duration of GraphQL operations',
    labelNames: ['operationType', 'operationName', 'status'],
});

const failedRequestCounter = new Counter({
    name: 'graphql_failed_requests_total',
    help: 'Number of failed GraphQL operations',
    labelNames: ['operationType', 'operationName'],
});

const resolverDurationSummary = new Summary({
    name: 'graphql_resolver_duration_seconds',
    help: 'Duration of GraphQL resolver',
    labelNames: ['resolver'],
});


registry.registerMetric(requestCounter);
registry.registerMetric(requestDurationSummary);
registry.registerMetric(failedRequestCounter);
registry.registerMetric(resolverDurationSummary);

// 匯出 registry 給 /metrics 使用
export { registry };

export const metricsPlugin: ApolloServerPlugin = {
    async requestDidStart() {
        const start = process.hrtime();

        return {
            async willSendResponse(ctx) {
                const opType = ctx.operation?.operation || 'unknown';        // query / mutation / subscription
                const opName = ctx.operationName || 'anonymous';             // operation name or anonymous
                const status = ctx.errors?.length ? 'error' : 'success';

                // 1. Count total requests
                requestCounter.labels(opType, opName).inc();

                // 2. Duration
                const duration = process.hrtime(start);
                const durationInSec = duration[0] + duration[1] / 1e9;
                requestDurationSummary.labels(opType, opName, status).observe(durationInSec);

                // 3. Failure count
                if (status === 'error') {
                    failedRequestCounter.labels(opType, opName).inc();
                }
            },

            async executionDidStart() {
                return {
                    willResolveField({ info }) {
                        const start = process.hrtime();

                        return () => {
                            const duration = process.hrtime(start);
                            const durationMs = duration[0] * 1000 + duration[1] / 1e6;

                            const name = `${info.parentType.name}.${info.fieldName}`;
                            resolverDurationSummary.labels({ resolver: name }).observe(durationMs / 1000);
                        };
                    },
                };
            },
        };
    },
};