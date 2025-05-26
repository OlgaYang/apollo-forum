import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import DataLoader from "dataloader";

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

// ===== GraphQL Schema =====
const typeDefs = `#graphql
   enum ReactionType {
    LIKE
    DISLIKE
    LAUGH
    SAD
  }

  enum SortOrder {
    ASC
    DESC
  }

  type User {
    id: ID!
    nickname: String!
    image: String
    posts: [Post!]!
  }

  type Post {
    id: ID!
    title: String!
    content: String!
    author: User!
    comments: [Comment!]!
    reactions: [Reaction!]!
  }

  type Comment {
    id: ID!
    content: String!
    author: User!    
  }

  type Reaction {
    id: ID!
    type: ReactionType!
    user: User!
  }

  type Query {
    user(id: ID!): User
    posts(order: SortOrder = DESC, first: Int): [Post!]!
  }

  type Mutation {
    createPost(userId: ID!, title: String!, content: String!): Post!
    addComment(userId: ID!, postId: ID!, content: String!): Comment!
    addReaction(userId: ID!, postId: ID!, type: ReactionType!): Reaction!
  }
`;

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

            console.log("✅ createPost result:", newPost);
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
const server = new ApolloServer({ typeDefs, resolvers });

startStandaloneServer(server, {
    context: async () => ({
        loaders: {
            // userLoader: new DataLoader(batchUsersByIds, { cache: false }),
            // postLoader: new DataLoader(batchPostsByAuthorIds, { cache: false }),
            userLoader: new DataLoader(batchUsersByIds),
            postLoader: new DataLoader(batchPostsByAuthorIds),
            commentLoader: new DataLoader(batchCommentsByPostIds),
            reactionLoader: new DataLoader(batchReactionsByPostIds),
        },
    }),
}).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
