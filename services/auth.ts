// services/auth.ts
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { auth } from "./firebase";

export async function signUp(email: string, password: string): Promise<User> {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function signIn(email: string, password: string): Promise<User> {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
}

export async function logOut(): Promise<void> {
    await signOut(auth);
}
