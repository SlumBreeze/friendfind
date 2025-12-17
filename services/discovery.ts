import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "./firebase";

export type DiscoverUser = {
    id: string;
    name: string;
    city: string;
    interests: string[];
    avatar?: string;
    bio?: string;
};

export async function getDiscoverUsers(myUid: string, myCity: string): Promise<DiscoverUser[]> {
    if (!myCity) return [];

    const q = query(collection(db, "users"), where("city", "==", myCity));
    const snap = await getDocs(q);

    const users: DiscoverUser[] = [];
    snap.forEach((docSnap) => {
        if (docSnap.id === myUid) return;
        const data = docSnap.data() as any;
        users.push({
            id: docSnap.id,
            name: data.name ?? data.email ?? "Anonymous",
            city: data.city ?? "",
            interests: Array.isArray(data.interests) ? data.interests : [],
            avatar: data.avatar ?? undefined,
            bio: data.bio ?? undefined,
        });
    });

    return users;
}
