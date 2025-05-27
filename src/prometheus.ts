import { Counter, collectDefaultMetrics, Registry } from 'prom-client';

// 建立 Prometheus registry（收集所有 metrics 的容器）
const registry = new Registry();

// 收集 Node.js 系統預設的 metrics（CPU、記憶體等）
collectDefaultMetrics({ register: registry });

// 建立 resolver 呼叫次數的 counter
export const resolverCounter = new Counter({
    name: 'graphql_resolver_calls_total',
    help: 'Count of GraphQL resolver calls',
    labelNames: ['resolver'],
});

registry.registerMetric(resolverCounter);

// 匯出 registry 給 /metrics 使用
export { registry };
