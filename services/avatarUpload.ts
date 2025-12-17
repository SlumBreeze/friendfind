import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload an avatar image to Firebase Storage
 * @param uid - User ID (used as filename for easy overwriting)
 * @param file - The image file to upload
 * @returns The download URL of the uploaded image
 */
export async function uploadAvatar(uid: string, file: File): Promise<string> {
    // Create a reference to 'avatars/{uid}'
    const storageRef = ref(storage, `avatars/${uid}`);

    // Upload the file
    await uploadBytes(storageRef, file);

    // Get the download URL
    const downloadURL = await getDownloadURL(storageRef);

    return downloadURL;
}
