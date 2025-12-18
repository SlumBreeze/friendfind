import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export async function reportUser(
    fromUid: string,
    toUid: string,
    reason: ReportReason,
    details?: string
) {
    try {
        await addDoc(collection(db, "reports"), {
            from: fromUid,
            to: toUid,
            reason,
            details: details || '',
            timestamp: serverTimestamp(),
            status: 'pending' // pending, reviewed, resolved
        });
        console.log(`User ${toUid} reported by ${fromUid} for ${reason}`);
    } catch (error) {
        console.error("Error reporting user:", error);
        throw error;
    }
}
