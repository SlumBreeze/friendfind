import { User, PotentialFriend, Match, Message, Meetup } from '../types';

export const SEED_CURRENT_USER: User = {
  id: 'me',
  name: 'Alex Rivera',
  email: 'alex@example.com',
  bio: 'Coffee enthusiast, amateur hiker, and React developer. Looking for hiking buddies!',
  city: 'San Francisco',
  avatar: 'https://picsum.photos/200/200?random=99',
  interests: ['Hiking', 'Coffee', 'Coding', 'Sci-Fi'],
  trustedContacts: ['mom@example.com', 'bestie@example.com']
};

export const SEED_POTENTIAL_FRIENDS: PotentialFriend[] = [
  { 
    id: 'user_1', 
    name: 'Jordan Lee', 
    email: 'j@t.com', 
    bio: 'Love exploring new cafes and reading books in the park. Always looking for book recommendations.', 
    city: 'San Francisco', 
    distance: 1.2, 
    avatar: 'https://picsum.photos/400/600?random=1', 
    interests: ['Coffee', 'Reading', 'Jazz', 'Museums'], 
    trustedContacts: [] 
  },
  { 
    id: 'user_2', 
    name: 'Casey Smith', 
    email: 'c@t.com', 
    bio: 'Training for a marathon. Need a running partner who doesn’t quit! Also love dogs.', 
    city: 'San Francisco', 
    distance: 2.5, 
    avatar: 'https://picsum.photos/400/600?random=2', 
    interests: ['Running', 'Fitness', 'Dogs', 'Outdoors'], 
    trustedContacts: [] 
  },
  { 
    id: 'user_3', 
    name: 'Taylor Doe', 
    email: 't@t.com', 
    bio: 'New to the city. Let’s check out some art galleries and grab wine afterwards.', 
    city: 'San Francisco', 
    distance: 0.8, 
    avatar: 'https://picsum.photos/400/600?random=3', 
    interests: ['Art', 'Museums', 'Wine', 'Photography'], 
    trustedContacts: [] 
  },
  { 
    id: 'user_4', 
    name: 'Riley Green', 
    email: 'r@t.com', 
    bio: 'Board game geek. I have Catan, Ticket to Ride, and complex strategy games. Need players!', 
    city: 'Oakland', 
    distance: 5.0, 
    avatar: 'https://picsum.photos/400/600?random=4', 
    interests: ['Board Games', 'Sci-Fi', 'Pizza', 'Gaming'], 
    trustedContacts: [] 
  },
  { 
    id: 'user_5', 
    name: 'Morgan Black', 
    email: 'm@t.com', 
    bio: 'Urban photographer. I like climbing rooftops and finding hidden gems in the city.', 
    city: 'San Francisco', 
    distance: 1.5, 
    avatar: 'https://picsum.photos/400/600?random=5', 
    interests: ['Photography', 'Climbing', 'Urban Exploring'], 
    trustedContacts: [] 
  },
];

// Existing Match: Alex & Jamie (Already matched)
const MATCH_ID_1 = 'match_seeded_1';
const MATCH_USER_ID = 'user_match_1';

export const SEED_MATCHES: Match[] = [
  {
    id: MATCH_ID_1,
    users: ['me', MATCH_USER_ID],
    timestamp: Date.now() - 86400000 * 2, // 2 days ago
    lastMessage: "Sounds good! See you then.",
    lastMessageTime: Date.now() - 3600000, // 1 hour ago
  }
];

// We need a profile for the matched user even if they aren't in discovery anymore
export const SEED_MATCHED_USERS_PROFILES: PotentialFriend[] = [
  {
    id: MATCH_USER_ID,
    name: 'Jamie Chen',
    email: 'jamie@t.com',
    bio: 'Foodie and movie buff.',
    city: 'San Francisco',
    distance: 3.0,
    avatar: 'https://picsum.photos/400/600?random=10',
    interests: ['Sushi', 'Movies', 'Hiking'],
    trustedContacts: []
  }
];

export const SEED_MEETUPS: Record<string, Meetup[]> = {
  [MATCH_ID_1]: [
    {
      id: 'meet_1',
      matchId: MATCH_ID_1,
      place: 'Marin Headlands Visitor Center',
      time: new Date(Date.now() + 86400000 * 2).toISOString(), // 2 days from now
      status: 'accepted',
      notes: 'Bring water!'
    }
  ]
};

export const SEED_MESSAGES: Record<string, Message[]> = {
  [MATCH_ID_1]: [
    {
      id: 'msg_1',
      matchId: MATCH_ID_1,
      senderId: 'system',
      text: 'You matched with Jamie Chen!',
      timestamp: Date.now() - 86400000 * 2,
      isSystem: true
    },
    {
      id: 'msg_2',
      matchId: MATCH_ID_1,
      senderId: MATCH_USER_ID,
      text: 'Hey Alex! I see you like hiking too.',
      timestamp: Date.now() - 86400000 * 2 + 5000,
    },
    {
      id: 'msg_3',
      matchId: MATCH_ID_1,
      senderId: 'me',
      text: 'Hi Jamie! Yes, usually go to Marin Headlands. Have you been?',
      timestamp: Date.now() - 86400000 * 2 + 60000,
    },
    {
      id: 'msg_4',
      matchId: MATCH_ID_1,
      senderId: MATCH_USER_ID,
      text: 'Love it there. We should go sometime!',
      timestamp: Date.now() - 86400000,
    },
    {
      id: 'msg_5',
      matchId: MATCH_ID_1,
      senderId: 'me',
      text: 'Definitely. How about this Saturday?',
      timestamp: Date.now() - 3600000 * 2,
    },
    {
      id: 'msg_meetup_1',
      matchId: MATCH_ID_1,
      senderId: 'system',
      text: 'Meetup Proposed',
      timestamp: Date.now() - 3600000 * 1.5,
      isSystem: true,
      meetupId: 'meet_1'
    },
    {
      id: 'msg_6',
      matchId: MATCH_ID_1,
      senderId: MATCH_USER_ID,
      text: 'Sounds good! See you then.',
      timestamp: Date.now() - 3600000,
    }
  ]
};