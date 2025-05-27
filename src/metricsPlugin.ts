import { ApolloServerPlugin } from '@apollo/server';
import { resolverCounter } from './prometheus.js';

export const metricsPlugin: ApolloServerPlugin = {
    async requestDidStart() {
        return {
            async executionDidStart() {
                return {
                    willResolveField({ info }) {
                        const name = `${info.parentType.name}.${info.fieldName}`;
                        resolverCounter.labels({ resolver: name }).inc(); // 加一筆記錄
                    },
                };
            },
        };
    },
};
