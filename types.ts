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
  bio: string;
  city: string;
  avatar: string;
  interests: string[];
  trustedContacts: string[]; // List of email addresses
}

// Collection: "matches"
// Document ID: Auto-generated
export interface Match {
  id: string;
  users: [string, string]; // [userId1, userId2] - Used for "array-contains" queries
  timestamp: number; // Created At
  lastMessage?: string;
  lastMessageTime?: number; // Used for sorting matches list
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
export interface PotentialFriend extends User {
  distance: number; // Calculated on client or via Cloud Function
}