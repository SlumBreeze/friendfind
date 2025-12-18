import {
    doc, setDoc, getDoc, collection, query, where, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { Match, PotentialFriend } from "../types";

// 1. Record a Swipe and Check for Match
export async function swipeUser(
    myUid: string,
    otherUser: PotentialFriend,
    direction: 'left' | 'right'
): Promise<Match | null> {

    // A. Record the Swipe in 'swipes' collection
    // ID format: "fromUid_toUid" to ensure one vote per person
    const swipeId = `${myUid}_${otherUser.id}`;
    await setDoc(doc(db, "swipes", swipeId), {
        from: myUid,
        to: otherUser.id,
        type: direction,
        timestamp: serverTimestamp()
    });

    if (direction === 'left') return null;

    // B. Check if they already liked you (Mutual Match)
    const otherSwipeId = `${otherUser.id}_${myUid}`;
    const otherSwipeSnap = await getDoc(doc(db, "swipes", otherSwipeId));

    if (otherSwipeSnap.exists() && otherSwipeSnap.data().type === 'right') {
        // IT'S A MATCH! Create the match document

        // Create a deterministic Match ID (sort UIDs) so we don't create duplicates
        const sortedIds = [myUid, otherUser.id].sort();
        const matchId = `${sortedIds[0]}_${sortedIds[1]}`;

        const newMatch: Match = {
            id: matchId,
            users: [myUid, otherUser.id],
            timestamp: Date.now(),
            lastMessage: "You matched! Say hi 👋",
            lastMessageTime: Date.now()
        };

        // Save match to Firestore
        await setDoc(doc(db, "matches", matchId), newMatch, { merge: true });

        return newMatch;
    }

    return null;
}

// 2. Listen for Matches
export function subscribeToMatches(myUid: string, onUpdate: (matches: Match[]) => void) {
    // Query matches where 'users' array contains myUid
    const q = query(
        collection(db, "matches"),
        where("users", "array-contains", myUid)
    );

    return onSnapshot(q, (snapshot) => {
        const matches = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                ...data
            } as Match;
        });
        // Sort by newest message first
        matches.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        onUpdate(matches);
    });
}
