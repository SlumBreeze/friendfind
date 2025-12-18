export enum ViewState {
  AUTH = 'AUTH',
  DISCOVER = 'DISCOVER',
  MATCHES = 'MATCHES',
  CHAT = 'CHAT',
  PROFILE = 'PROFILE',
}

// --- FIRESTORE SCHEMA MAPPING ---

// Collection: "users"
// Document ID: User UID (from Auth)
export interface User {
  id: string;
  name: string;
  email: string;
  city: string;
  interests: string[];
  trustedContacts: string[]; // List of email addresses
  // Make these optional because new users might not have them yet
  bio?: string;
  avatar?: string;
}

// Collection: "matches"
// Document ID: Auto-generated
export interface Match {
  id: string;
  users: [string, string]; // [userId1, userId2] - Used for "array-contains" queries
  timestamp: number; // Created At
  lastMessage?: string;
  lastMessageTime?: number; // Used for sorting matches list
  lastRead?: Record<string, number>; // { [userId]: timestamp } - Last time user read the chat
}

// Subcollection: "matches/{matchId}/messages"
// Document ID: Auto-generated
export interface Message {
  id: string;
  matchId: string; // Redundant but useful for client-side routing
  senderId: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  meetupId?: string; // Links this message to a Meetup event
}

// Subcollection: "matches/{matchId}/meetups"
// Document ID: Auto-generated
export interface Meetup {
  id: string;
  matchId: string;
  place: string;
  time: string; // ISO 8601 String for easy parsing
  status: 'proposed' | 'accepted' | 'completed' | 'cancelled';
  notes?: string;
}

// Client-side only extension for Discovery View
// We use Omit to exclude private fields (email, contacts) that shouldn't be on public cards
export interface PotentialFriend extends Omit<User, 'email' | 'trustedContacts'> {
  distance: number; // Calculated on client or via Cloud Function
}