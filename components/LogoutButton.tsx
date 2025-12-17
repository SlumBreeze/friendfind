import { logOut } from "../services/auth";

export default function LogoutButton() {
    return (
        <button
            onClick={() => logOut()}
            className="w-full rounded-xl border px-4 py-3 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
        >
            Log out
        </button>
    );
}
