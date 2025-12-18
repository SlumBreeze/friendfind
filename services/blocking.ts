import { db } from "./firebase";
import {
    doc,
    setDoc,
    deleteDoc,
    serverTimestamp,
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

/**
 * Unmatches a user by deleting the match document.
 * Both users will lose access to the chat.
 */
export async function unmatchUser(matchId: string) {
    await deleteDoc(doc(db, "matches", matchId));
}

/**
 * Blocks a user. 
 * 1. Creates a record in 'blocks' collection so they don't appear in discovery.
 * 2. Unmatches them if a match exists.
 */
export async function blockUser(myUid: string, otherUid: string, matchId?: string) {
    // 1. Create block record
    const blockId = `${myUid}_${otherUid}`;
    await setDoc(doc(db, "blocks", blockId), {
        blockerId: myUid,
        blockedId: otherUid,
        timestamp: serverTimestamp()
    });

    // 2. Delete match if provided
    if (matchId) {
        await unmatchUser(matchId);
    }
}

/**
 * Check if a user is blocked (used in Discovery)
 * Returns a Set of user IDs that I have blocked.
 */
export async function getBlockedUserIds(myUid: string): Promise<Set<string>> {
    const q = query(collection(db, "blocks"), where("blockerId", "==", myUid));
    const snapshot = await getDocs(q);

    const blockedIds = new Set<string>();
    snapshot.forEach(doc => {
        blockedIds.add(doc.data().blockedId);
    });

    return blockedIds;
}
