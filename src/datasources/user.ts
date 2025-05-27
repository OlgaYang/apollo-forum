export const users = [
    { id: "1", nickname: "Alice", image: "img1.png" },
    { id: "2", nickname: "Bob", image: "img2.png" },
];

export function batchUsersByIds(ids: readonly string[]) {
    const result = ids.map((id) => users.find((u) => u.id === id));
    console.log("fetch user", "request", ids, "response", result)
    return Promise.resolve(result);
}