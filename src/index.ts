import { ApolloServer } from "@apollo/server";
import DataLoader from "dataloader";

// subscription 
import { createServer } from 'http';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { WebSocketServer } from 'ws';
import { useServer } from 'graphql-ws/lib/use/ws'; //Must use version 5.5.5, latest version won't support it
import express from 'express';
import cors from "cors";
import { expressMiddleware } from "@apollo/server/express4";
import { PubSub } from 'graphql-subscriptions';

// gencode
import { readFileSync } from 'fs';
import { gql } from 'graphql-tag';
import type { PostPayload } from './__generated__/types';

const typeDefs = gql(readFileSync('./src/schema.graphql', 'utf8'));



// ===== 模擬資料 =====
let nextPostId = 1000;
let nextCommentId = 2000;
let nextReactionId = 3000;

const users = [
    { id: "1", nickname: "Alice", image: "img1.png" },
    { id: "2", nickname: "Bob", image: "img2.png" },
];

const posts = [
    { id: "101", title: "Post A", content: "A content", authorId: "1" },
    { id: "102", title: "Post B", content: "B content", authorId: "2" },
    { id: "103", title: "Post C", content: "C content", authorId: "1" },
];

const comments: Array<{ id: string; content: string; authorId: string; postId: string }> = [];
const reactions: Array<{ id: string; type: string; userId: string; postId: string }> = [];


// ===== DataLoader Functions =====
function batchUsersByIds(ids: readonly string[]) {
    console.log("🟡 batchUsersByIds called with ids:", ids);
    const result = ids.map((id) => users.find((u) => u.id === id));
    console.log("✅ batchUsersByIds result:", result);
    return Promise.resolve(result);
}

function batchPostsByAuthorIds(ids: readonly string[]) {
    console.log("🟣 batchPostsByAuthorIds called with authorIds:", ids);

    const map = new Map<string, any[]>();
    for (const id of ids) map.set(id, []);
    for (const post of posts) {
        map.get(post.authorId)?.push(post);
    }
    const result = ids.map((id) => map.get(id));
    console.log("✅ batchPostsByAuthorIds result:", result);
    return Promise.resolve(ids.map((id) => map.get(id)));
}

function batchCommentsByPostIds(postIds: readonly string[]) {
    console.log("💬 batchCommentsByPostIds:", postIds);

    const map = new Map<string, any[]>();
    for (const id of postIds) map.set(id, []);
    for (const comment of comments) {
        map.get(comment.postId)?.push(comment);
    }

    const result = postIds.map((id) => map.get(id));
    console.log("✅ batchCommentsByPostIds result:", result);
    return Promise.resolve(result);
}

function batchReactionsByPostIds(postIds: readonly string[]) {
    console.log("❤️ batchReactionsByPostIds:", postIds);

    const map = new Map<string, any[]>();
    for (const id of postIds) map.set(id, []);
    for (const reaction of reactions) {
        map.get(reaction.postId)?.push(reaction);
    }

    const result = postIds.map((id) => map.get(id));
    console.log("✅ batchReactionsByPostIds result:", result);
    return Promise.resolve(result);
}

const POST_CREATED = 'POST_CREATED';
const pubsub = new PubSub<{ POST_CREATED: PostPayload }>();

// ===== Resolvers =====
const resolvers = {
    Query: {
        user: (_, { id }) => users.find((u) => u.id === id),
        posts: (_, { order = "DESC", first }) => {
            const sorted = [...posts].sort((a, b) => {
                const aid = parseInt(a.id, 10);
                const bid = parseInt(b.id, 10);
                return order === "ASC" ? aid - bid : bid - aid;
            });
            return first ? sorted.slice(0, first) : sorted;
        }
    },
    Mutation: {
        createPost: (_, { userId, title, content }) => {
            console.log("🟣 createPost called with authorIds:", userId);

            const user = users.find((u) => u.id === userId);
            if (!user) throw new Error("User not found");

            const newPost = {
                id: (nextPostId++).toString(),
                title,
                content,
                authorId: userId
            };

            posts.push(newPost);
            const newPostPayload: PostPayload = {
                id: newPost.id,
                title: newPost.title,
                content: newPost.content,
                authorId: newPost.authorId
            };
            pubsub.publish(POST_CREATED, newPostPayload);
            console.log("✅ createPost result:", newPostPayload);
            return newPost;
        },
        addComment: (_, { userId, postId, content }) => {
            const user = users.find((u) => u.id === userId);
            const post = posts.find((p) => p.id === postId);
            if (!user || !post) throw new Error("User or Post not found");

            const newComment = {
                id: (nextCommentId++).toString(),
                content,
                authorId: userId,
                postId,
            };

            comments.push(newComment);
            return newComment;
        },

        addReaction: (_, { userId, postId, type }) => {
            const user = users.find((u) => u.id === userId);
            const post = posts.find((p) => p.id === postId);
            if (!user || !post) throw new Error("User or Post not found");

            // 找出是否已有相同 type 的 reaction
            const existingIndex = reactions.findIndex(
                (r) => r.userId === userId && r.postId === postId && r.type === type
            );

            if (existingIndex !== -1) {
                // 已經有這筆 reaction，表示取消
                const removed = reactions.splice(existingIndex, 1)[0];
                console.log("❌ Removed reaction: ", removed);
                return removed;
            } else {
                // 新增 reaction
                const newReaction = {
                    id: (nextReactionId++).toString(),
                    type,
                    userId,
                    postId,
                };
                reactions.push(newReaction);
                console.log("✅ Added new reaction:", newReaction);
                return newReaction;
            }
        }

    },
    Subscription: {
        postCreated: {
            subscribe: () => pubsub.asyncIterableIterator([POST_CREATED]),
            resolve: (payload) => payload
        },
    },

    User: {
        posts: (parent, _, { loaders }) => loaders.postLoader.load(parent.id),
    },
    Post: {
        author: (parent, _, { loaders }) => loaders.userLoader.load(parent.authorId),
        comments: (parent, _, { loaders }) => loaders.commentLoader.load(parent.id),
        reactions: (parent, _, { loaders }) => loaders.reactionLoader.load(parent.id),
    },
    Comment: {
        author: (parent, _, { loaders }) => loaders.userLoader.load(parent.authorId),
    },
    Reaction: {
        user: (parent, _, { loaders }) => loaders.userLoader.load(parent.userId),
    },
};

// ===== Server 啟動 =====
const schema = makeExecutableSchema({ typeDefs, resolvers });

// This `app` is the returned value from `express()`.
const app = express();
const httpServer = createServer(app);

// Creating the WebSocket server
const wsServer = new WebSocketServer({
    // This is the `httpServer` we created in a previous step.
    server: httpServer,
    // Pass a different path here if app.use
    // serves expressMiddleware at a different path
    path: '/subscriptions',
});

const serverCleanup = useServer({ schema }, wsServer);

const server = new ApolloServer({
    schema,
    plugins: [
        // Proper shutdown for the HTTP server.
        ApolloServerPluginDrainHttpServer({ httpServer }),

        // Proper shutdown for the WebSocket server.
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

});


await server.start();

app.use(
    "/graphql",
    cors<cors.CorsRequest>(),
    express.json(),
    expressMiddleware(server, {
        context: async () => ({
            loaders: {
                userLoader: new DataLoader(batchUsersByIds),
                postLoader: new DataLoader(batchPostsByAuthorIds),
                commentLoader: new DataLoader(batchCommentsByPostIds),
                reactionLoader: new DataLoader(batchReactionsByPostIds),
            },
        }),
    })
);

const PORT = 4000;
// Now that our HTTP server is fully set up, we can listen to it.
httpServer.listen(PORT, () => {
    console.log(`Server is now running on http://localhost:${PORT}/graphql`);
});
