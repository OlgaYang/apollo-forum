import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import DataLoader from "dataloader";

// ===== 模擬資料 =====
const users = [
    { id: "1", nickname: "Alice", image: "img1.png" },
    { id: "2", nickname: "Bob", image: "img2.png" },
];

const posts = [
    { id: "101", title: "Post A", content: "A content", authorId: "1" },
    { id: "102", title: "Post B", content: "B content", authorId: "2" },
    { id: "103", title: "Post C", content: "C content", authorId: "1" },
];

// ===== GraphQL Schema =====
const typeDefs = `#graphql
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
  }

  type Query {
    user(id: ID!): User
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

// ===== Resolvers =====
const resolvers = {
    Query: {
        user: (_, { id }) => users.find((u) => u.id === id),
    },
    User: {
        posts: (parent, _, { loaders }) => loaders.postLoader.load(parent.id),
    },
    Post: {
        author: (parent, _, { loaders }) => loaders.userLoader.load(parent.authorId),
    },
};

// ===== Server 啟動 =====
const server = new ApolloServer({ typeDefs, resolvers });

startStandaloneServer(server, {
    context: async () => ({
        loaders: {
            userLoader: new DataLoader(batchUsersByIds),
            postLoader: new DataLoader(batchPostsByAuthorIds),
        },
    }),
}).then(({ url }) => {
    console.log(`🚀 Server ready at ${url}`);
});
