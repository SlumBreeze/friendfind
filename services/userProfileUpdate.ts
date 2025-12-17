import { doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";

export async function updateMyProfile(
    uid: string,
    updates: {
        city?: string;
        interests?: string[];
        trustedContacts?: string[];
        name?: string;
        avatar?: string;
        bio?: string;
    }
): Promise<void> {
    const ref = doc(db, "users", uid);
    await updateDoc(ref, updates);
}
