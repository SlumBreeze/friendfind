// components/AuthGate.tsx
import React, { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "../services/firebase";
import AuthPage from "./AuthPage";

type Props = {
    children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (u) => {
            setUser(u);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-primary-400 flex items-center justify-center">
                <div className="animate-spin h-10 w-10 border-4 border-white border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!user) {
        return <AuthPage />;
    }

    return <>{children}</>;
}
