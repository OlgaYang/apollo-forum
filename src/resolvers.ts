import { users } from "./datasources/user.js"
import { posts, createPost } from "./datasources/post.js";
import { addComment } from "./datasources/comment.js";
import { toggleReaction } from "./datasources/reaction.js";
import { PubSub } from "graphql-subscriptions";
import type { PostPayload } from "./__generated__/types";

const POST_CREATED = 'POST_CREATED';
const pubsub = new PubSub<{ POST_CREATED: PostPayload }>();

export const resolvers = {
    Query: {
        user: (_, { id }) => users.find((u) => u.id === id),
        posts: (_, { order = "DESC", first }) => {
            const sorted = [...posts].sort((a, b) => {
                const aid = parseInt(a.id, 10);
                const bid = parseInt(b.id, 10);
                return order === "ASC" ? aid - bid : bid - aid;
            });
            return first ? sorted.slice(0, first) : sorted;
        },
    },
    Mutation: {
        createPost: (_, { userId, title, content }) => {
            const user = users.find((u) => u.id === userId);
            if (!user) throw new Error("User not found");
            const newPost = createPost(userId, title, content);
            pubsub.publish(POST_CREATED, newPost);
            return newPost;
        },
        addComment: (_, { userId, postId, content }) => {
            const user = users.find((u) => u.id === userId);
            const post = posts.find((p) => p.id === postId);
            if (!user || !post) throw new Error("User or Post not found");
            return addComment(userId, postId, content);
        },
        addReaction: (_, { userId, postId, type }) => {
            const user = users.find((u) => u.id === userId);
            const post = posts.find((p) => p.id === postId);
            if (!user || !post) throw new Error("User or Post not found");
            return toggleReaction(userId, postId, type);
        },
    },
    Subscription: {
        postCreated: {
            subscribe: () => pubsub.asyncIterableIterator(POST_CREATED),
            resolve: (payload) => payload,
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
