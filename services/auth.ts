// services/auth.ts
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

export async function signUp(email: string, password: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", cred.user.uid), {
        email: cred.user.email,
        city: "",
        interests: [],
        trustedContacts: [],
        createdAt: serverTimestamp(),
    });

    return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function logOut(): Promise<void> {
    await signOut(auth);
}
