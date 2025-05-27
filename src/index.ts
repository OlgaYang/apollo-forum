import { ApolloServer } from "@apollo/server";
import { createServer } from "http";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import { WebSocketServer } from "ws";
import { useServer } from "graphql-ws/lib/use/ws";
import express from "express";
import cors from "cors";
import { expressMiddleware } from "@apollo/server/express4";
import { gql } from "graphql-tag";
import { readFileSync } from "fs";
import DataLoader from "dataloader";

import { resolvers } from "./resolvers.js";

import { batchUsersByIds } from "./datasources/user.js"
import { batchPostsByAuthorIds } from "./datasources/post.js"
import { batchCommentsByPostIds } from "./datasources/comment.js"
import { batchReactionsByPostIds } from "./datasources/reaction.js"

//auth
import admin from "./firebase.js";

import depthLimit from 'graphql-depth-limit';

const typeDefs = gql(readFileSync("./schema.graphql", "utf8"));
const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();
const httpServer = createServer(app);

const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/graphql",
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
    schema,
    plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        {
            async serverWillStart() {
                return {
                    async drainServer() {
                        await serverCleanup.dispose();
                    },
                };
            },
        },
    ],
    validationRules: [depthLimit(5)],
});

await server.start();

app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
        context: async ({ req }) => {
            const authHeader = req.headers.authorization || "";
            const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

            let user: admin.auth.DecodedIdToken | null = null;
            if (token) {
                try {
                    user = await admin.auth().verifyIdToken(token);
                } catch (err) {
                    console.warn("Invalid JWT token:", err);
                }
            }

            return {
                user,
                loaders: {
                    userLoader: new DataLoader(batchUsersByIds,),
                    postLoader: new DataLoader(batchPostsByAuthorIds,),
                    commentLoader: new DataLoader(batchCommentsByPostIds,),
                    reactionLoader: new DataLoader(batchReactionsByPostIds,),
                },
            };
        },
    })
);

const PORT = 4000;
httpServer.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
});
