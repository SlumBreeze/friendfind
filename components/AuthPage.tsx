// components/AuthPage.tsx
import React, { useState } from "react";
import { signIn, signUp } from "../services/auth";
import { Button } from "./Button";
import { UserIcon } from "./Icons";

export default function AuthPage() {
    const [mode, setMode] = useState<"signin" | "signup">("signup");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        setError(null);

        try {
            if (mode === "signup") {
                await signUp(email.trim(), password);
            } else {
                await signIn(email.trim(), password);
            }
            // Auth state change will be detected by App.tsx via onAuthStateChanged
        } catch (err: any) {
            // Parse Firebase error codes into friendly messages
            const code = err?.code || '';
            if (code === 'auth/user-not-found') {
                setError('No account found with this email.');
            } else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
                setError('Invalid email or password.');
            } else if (code === 'auth/email-already-in-use') {
                setError('An account with this email already exists.');
            } else if (code === 'auth/invalid-email') {
                setError('Invalid email address.');
            } else if (code === 'auth/weak-password') {
                setError('Password must be at least 6 characters.');
            } else {
                setError(err?.message ?? "Authentication failed.");
            }
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="min-h-screen bg-primary-400 flex flex-col items-center justify-center p-6 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[60%] bg-primary-500 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

            <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md relative z-10">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <div className="bg-primary-400 p-3 rounded-2xl rotate-3">
                        <UserIcon className="w-10 h-10 text-stone-900" />
                    </div>
                </div>

                <h1 className="text-3xl font-bold text-center text-stone-900 mb-2">FriendFind</h1>
                <p className="text-center text-stone-500 mb-8">
                    {mode === "signup" ? "Create your account to get started." : "Welcome back! Sign in to continue."}
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Email</label>
                        <input
                            type="email"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all"
                            placeholder="hello@friendfind.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoComplete="email"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-stone-700 mb-1">Password</label>
                        <input
                            type="password"
                            className="w-full px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-primary-400 focus:border-transparent outline-none transition-all"
                            placeholder="6+ characters"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete={mode === "signup" ? "new-password" : "current-password"}
                            required
                            minLength={6}
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
                            {error}
                        </div>
                    )}

                    <Button type="submit" fullWidth size="lg" className="mt-4" disabled={busy}>
                        {busy ? "Please wait..." : mode === "signup" ? "Create Account" : "Sign In"}
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    {mode === "signup" ? (
                        <button
                            type="button"
                            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                            onClick={() => { setMode("signin"); setError(null); }}
                        >
                            Already have an account? <span className="font-semibold text-accent-500">Sign In</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="text-sm text-stone-500 hover:text-stone-700 transition-colors"
                            onClick={() => { setMode("signup"); setError(null); }}
                        >
                            New here? <span className="font-semibold text-accent-500">Create Account</span>
                        </button>
                    )}
                </div>

                <p className="text-xs text-center text-stone-400 mt-6">
                    By signing up, you agree to our Terms & Safety Guidelines.
                </p>
            </div>
        </div>
    );
}
