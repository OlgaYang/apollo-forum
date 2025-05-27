export const reactions: Array<{ id: string; type: string; userId: string; postId: string }> = [];

let nextReactionId = 3000;
export function toggleReaction(userId: string, postId: string, type: string) {
    const index = reactions.findIndex(r => r.userId === userId && r.postId === postId && r.type === type);
    if (index !== -1) return reactions.splice(index, 1)[0];
    const newReaction = {
        id: (nextReactionId++).toString(),
        type,
        userId,
        postId,
    };
    reactions.push(newReaction);
    return newReaction;
}

export function batchReactionsByPostIds(postIds: readonly string[]) {
    const map = new Map<string, any[]>();
    for (const id of postIds) map.set(id, []);
    for (const reaction of reactions) {
        map.get(reaction.postId)?.push(reaction);
    }

    console.log("fetch reactions", "request", postIds, "response", map)
    return Promise.resolve(postIds.map((id) => map.get(id)));
}