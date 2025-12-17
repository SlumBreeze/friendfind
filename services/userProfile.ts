import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export type FirestoreUserProfile = {
    id: string;
    name: string;
    city: string;
    interests: string[];
    trustedContacts: string[];
};

export async function getMyProfile(uid: string, email: string | null): Promise<FirestoreUserProfile> {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
        // Fallback if the document somehow doesn't exist
        return {
            id: uid,
            name: email ?? "Anonymous",
            city: "",
            interests: [],
            trustedContacts: [],
        };
    }

    const data = snap.data() as any;

    return {
        id: uid,
        name: (data.name ?? email ?? "Anonymous") as string,
        city: (data.city ?? "") as string,
        interests: Array.isArray(data.interests) ? data.interests : [],
        trustedContacts: Array.isArray(data.trustedContacts) ? data.trustedContacts : [],
    };
}
