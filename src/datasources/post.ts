export const posts: Array<{ id: string; title: string; content: string; authorId: string }> = [
    { id: "101", title: "Post A", content: "A content", authorId: "uvaoXdGxCHZfuHW91cIDH5s7KnB3" },
    { id: "102", title: "Post B", content: "B content", authorId: "aMjLVvoozmbbfKXrpT31uqn9mkn1" },
    { id: "103", title: "Post C", content: "C content", authorId: "uvaoXdGxCHZfuHW91cIDH5s7KnB3" },
];

let nextPostId = 1000;
export function createPost(userId: string, title: string, content: string) {
    const newPost = {
        id: (nextPostId++).toString(),
        title,
        content,
        authorId: userId,
    };
    posts.push(newPost);
    return newPost;
}

export function batchPostsByAuthorIds(ids: readonly string[]) {
    const map = new Map<string, any[]>();
    for (const id of ids) map.set(id, []);
    for (const post of posts) {
        map.get(post.authorId)?.push(post);
    }
    console.log("fetch posts", "request", ids, "response", map)
    return Promise.resolve(ids.map((id) => map.get(id)));
}