import {
    collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { Meetup } from "../types";

// 1. Create a Meetup
export async function createMeetup(matchId: string, place: string, time: string) {
    // Add to subcollection: matches/{matchId}/meetups
    const docRef = await addDoc(collection(db, "matches", matchId, "meetups"), {
        matchId,
        place,
        time,
        status: 'proposed',
        timestamp: Date.now()
    });
    return docRef.id;
}

// 2. Listen to Meetups for a specific Match
export function subscribeToMeetups(matchId: string, onUpdate: (meetups: Meetup[]) => void) {
    const q = query(
        collection(db, "matches", matchId, "meetups"),
        orderBy("timestamp", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const meetups = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Meetup));
        onUpdate(meetups);
    });
}

// 3. Update Status (e.g., Accept/Cancel)
export async function updateMeetupStatus(
    matchId: string,
    meetupId: string,
    status: 'accepted' | 'cancelled' | 'completed'
) {
    const ref = doc(db, "matches", matchId, "meetups", meetupId);
    await updateDoc(ref, { status });
}
