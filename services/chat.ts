import {
    collection, addDoc, query, orderBy, onSnapshot, doc, updateDoc
} from "firebase/firestore";
import { db } from "./firebase";
import { Message } from "../types";

// 1. Send a Message
export async function sendMessage(matchId: string, senderId: string, text: string) {
    // Add to subcollection
    await addDoc(collection(db, "matches", matchId, "messages"), {
        matchId,
        senderId,
        text,
        timestamp: Date.now(),
        isSystem: false
    });

    // Update the parent match with the latest text snippet
    await updateDoc(doc(db, "matches", matchId), {
        lastMessage: text,
        lastMessageTime: Date.now()
    });
}

// 2. Listen to a specific Match's messages
export function subscribeToMessages(matchId: string, onUpdate: (msgs: Message[]) => void) {
    const q = query(
        collection(db, "matches", matchId, "messages"),
        orderBy("timestamp", "asc")
    );

    return onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as Message));
        onUpdate(msgs);
    });
}
