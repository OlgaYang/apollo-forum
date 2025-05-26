export const comments: Array<{ id: string; content: string; authorId: string; postId: string }> = [];

let nextCommentId = 2000;
export function addComment(userId: string, postId: string, content: string) {
    const newComment = {
        id: (nextCommentId++).toString(),
        content,
        authorId: userId,
        postId,
    };
    comments.push(newComment);
    return newComment;
}

// 📁 src/datasources/reaction.ts
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

export function batchCommentsByPostIds(postIds: readonly string[]) {
    const map = new Map<string, any[]>();
    for (const id of postIds) map.set(id, []);
    for (const comment of comments) {
        map.get(comment.postId)?.push(comment);
    }
    return Promise.resolve(postIds.map((id) => map.get(id)));
}