import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { logOut } from './services/auth';
import { auth } from './services/firebase';
import { getMyProfile } from './services/userProfile';
import { updateMyProfile } from './services/userProfileUpdate';
import { getDiscoverUsers } from './services/discovery';
import { swipeUser, subscribeToMatches } from './services/matching';
import { sendMessage, subscribeToMessages, markChatAsRead } from './services/chat';
import { createMeetup, subscribeToMeetups, updateMeetupStatus } from './services/meetups';
import { blockUser, unmatchUser, getBlockedUserIds } from './services/blocking';
import { ViewState, User, PotentialFriend, Match, Message, Meetup } from './types';
import { Button } from './components/Button';
import {
  UserIcon, MessageIcon, CompassIcon, HeartIcon, XIcon, ShieldIcon,
  ChevronLeftIcon, CalendarIcon, SendIcon, MapPinIcon
} from './components/Icons';
import { generateIcebreakers, composeSafetyMessage } from './services/geminiService';
import AuthGate from './components/AuthGate';
import LogoutButton from './components/LogoutButton';

const App: React.FC = () => {
  // --- APP STATE ---
  const [view, setView] = useState<ViewState>(ViewState.DISCOVER);
  const [user, setUser] = useState<User | null>(null);

  // Data stores
  const [potentialFriends, setPotentialFriends] = useState<PotentialFriend[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [meetups, setMeetups] = useState<Record<string, Meetup[]>>({});
  const [otherUserProfiles, setOtherUserProfiles] = useState<Record<string, PotentialFriend>>({});

  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);

  // Chat State
  const [inputMsg, setInputMsg] = useState('');
  const [showMeetupModal, setShowMeetupModal] = useState(false);
  const [meetupForm, setMeetupForm] = useState({ place: '', time: '' });

  // Safety State
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [alertStatus, setAlertStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  // Profile Form State
  const [profileCity, setProfileCity] = useState("");
  const [profileInterests, setProfileInterests] = useState("");
  const [profileContacts, setProfileContacts] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  // Blocking & Safety UI State
  const [blockedUserIds, setBlockedUserIds] = useState<Set<string>>(new Set());
  const [showSafetyOptions, setShowSafetyOptions] = useState(false); // Dropdown in chat
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showUnmatchConfirm, setShowUnmatchConfirm] = useState(false);

  // --- INIT DATA ---
  // Note: Meetups now come from Firestore via subscribeToMeetups, no seed data needed

  // --- LOAD USER PROFILE & LISTENER ---
  useEffect(() => {
    let unsubscribeMatches: () => void;

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setUser(null);
        setMatches([]); // Clear matches on logout
        setMessages({}); // Clear messages on logout
        return;
      }

      // 1. Load My Profile
      const profile = await getMyProfile(fbUser.uid, fbUser.email);

      setUser({
        id: profile.id,
        name: profile.name,
        email: fbUser.email || '',
        city: profile.city,
        interests: profile.interests,
        trustedContacts: profile.trustedContacts,
        bio: profile.bio,
        avatar: profile.avatar
      });

      // 2. Load Blocked Users
      const blocked = await getBlockedUserIds(fbUser.uid);
      setBlockedUserIds(blocked);

      // 3. Load Discovery (Potential Friends) - Filter out blocked users
      const discovered = await getDiscoverUsers(fbUser.uid, profile.city);
      setPotentialFriends(
        discovered
          .filter(p => !blocked.has(p.id)) // Filter blocked users
          .map((p) => ({
            id: p.id,
            name: p.name,
            city: p.city,
            interests: p.interests,
            bio: p.bio,
            distance: 0,
            avatar: p.avatar ?? "https://via.placeholder.com/600x800",
          }))
      );

      // 4. LISTEN TO REAL MATCHES
      unsubscribeMatches = subscribeToMatches(fbUser.uid, async (realMatches) => {
        setMatches(realMatches);

        // Fetch profiles for people we matched with (so we have their name/avatar)
        const profilesToFetch: string[] = [];

        for (const m of realMatches) {
          const otherId = m.users.find(u => u !== fbUser.uid);
          if (otherId) {
            profilesToFetch.push(otherId);
          }
        }

        // Fetch all profiles in parallel
        const fetchedProfiles: Record<string, PotentialFriend> = {};
        await Promise.all(
          profilesToFetch.map(async (otherId) => {
            const p = await getMyProfile(otherId, null);
            fetchedProfiles[otherId] = {
              id: p.id,
              name: p.name,
              city: p.city,
              interests: p.interests,
              avatar: p.avatar,
              bio: p.bio,
              distance: 0
            };
          })
        );

        // Use functional update to avoid stale closure
        setOtherUserProfiles(prev => ({ ...prev, ...fetchedProfiles }));
      });
    });

    return () => {
      unsubAuth();
      if (unsubscribeMatches) unsubscribeMatches();
    };
  }, []);

  // --- HELPERS ---
  const handleLogout = async () => {
    await logOut();
  };

  // Fill profile form when user loads
  useEffect(() => {
    if (!user) return;
    setProfileCity(user.city ?? "");
    setProfileInterests((user.interests ?? []).join(", "));
    setProfileContacts((user.trustedContacts ?? []).join(", "));
    // No more (user as any)
    setProfileAvatar(user.avatar ?? "");
    setProfileBio(user.bio ?? "");
  }, [user]);

  // --- CHAT & MEETUP LISTENER ---
  useEffect(() => {
    if (!activeMatchId) return;

    // A. Subscribe to Messages
    const unsubMsg = subscribeToMessages(activeMatchId, (newMsgs) => {
      setMessages(prev => ({
        ...prev,
        [activeMatchId]: newMsgs
      }));
      // Mark as read immediately when we see messages
      if (user) {
        markChatAsRead(activeMatchId, user.id);
      }
    });

    // B. Subscribe to Meetups
    const unsubMeetup = subscribeToMeetups(activeMatchId, (newMeetups) => {
      setMeetups(prev => ({
        ...prev,
        [activeMatchId]: newMeetups
      }));
    });

    return () => {
      unsubMsg();
      unsubMeetup();
    };
  }, [activeMatchId, user]);

  // Save profile handler
  const handleSaveProfile = async () => {
    const fbUser = auth.currentUser;
    if (!fbUser) return;

    const interests = profileInterests
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    const trustedContacts = profileContacts
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    setProfileSaving(true);
    try {
      await updateMyProfile(fbUser.uid, {
        city: profileCity.trim(),
        interests,
        trustedContacts,
        avatar: profileAvatar.trim() || undefined,
        bio: profileBio.trim() || undefined,
      });

      // Update local state so UI refreshes immediately
      setUser(prev => prev ? ({
        ...prev,
        city: profileCity.trim(),
        interests,
        trustedContacts,
        avatar: profileAvatar.trim() || undefined,
        bio: profileBio.trim() || undefined,
        // Ensure strictly required fields are preserved
        email: prev.email
      }) : prev);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleSwipe = async (direction: 'left' | 'right') => {
    if (potentialFriends.length === 0 || !user) return;
    const currentProfile = potentialFriends[0];

    // Remove top card immediately for UI responsiveness
    setPotentialFriends(prev => prev.slice(1));

    try {
      // Call the service
      const match = await swipeUser(user.id, currentProfile, direction);

      if (match) {
        // It's a match! The snapshot listener will update 'matches', 
        // but we can show a localized alert or effect here.
        alert(`It's a match with ${currentProfile.name}!`);

        // Don't store a system message here - both users would see the same name.
        // The match banner is generated client-side based on who the other user is.
      }
    } catch (error) {
      console.error("Swipe failed:", error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputMsg.trim() || !activeMatchId || !user) return;

    const textToSend = inputMsg;
    setInputMsg(''); // Clear input immediately

    try {
      await sendMessage(activeMatchId, user.id, textToSend);
      // No need to setMessages manually; the subscription will do it.
    } catch (error) {
      console.error("Error sending message:", error);
      alert("Failed to send message");
    }
  };

  const handleCreateMeetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatchId || !meetupForm.place || !meetupForm.time || !user) return;

    try {
      // 1. Save Meetup to Firestore
      const meetupId = await createMeetup(activeMatchId, meetupForm.place, meetupForm.time);

      // 2. Send a System Message so it appears in the chat flow
      // We link the message to the meetupId so the UI knows to render the card
      await sendMessage(activeMatchId, 'system', 'Meetup Proposed', meetupId);

      setShowMeetupModal(false);
      setMeetupForm({ place: '', time: '' });
    } catch (error) {
      console.error("Failed to create meetup:", error);
      alert("Could not save meetup.");
    }
  };

  const handleSafetyAlert = async () => {
    if (!activeMatchId) return;
    setAlertStatus('sending');

    const currentMeetups = meetups[activeMatchId] || [];
    const latestMeetup = currentMeetups[currentMeetups.length - 1];
    const match = matches.find(m => m.id === activeMatchId);
    const friendId = match?.users.find(uid => uid !== user?.id) || 'unknown';
    const friendName = otherUserProfiles[friendId]?.name || "your match";

    const emailBody = await composeSafetyMessage(
      user!.name,
      friendName,
      latestMeetup?.place || "Unknown Location",
      latestMeetup?.time || "Now"
    );

    setTimeout(() => {
      console.log(`[EMAIL SENT] To: ${user!.trustedContacts.join(', ')}`);
      console.log(`[BODY]: ${emailBody}`);
      setAlertStatus('sent');
      setTimeout(() => {
        setShowSafetyModal(false);
        setAlertStatus('idle');
      }, 2000);
    }, 1500);
  };

  const handleUnmatch = async () => {
    if (!activeMatchId) return;
    try {
      await unmatchUser(activeMatchId);
      setActiveMatchId(null);
      setView(ViewState.MATCHES);
      setShowUnmatchConfirm(false);
    } catch (e) {
      console.error("Unmatch failed:", e);
      alert("Failed to unmatch. Please try again.");
    }
  };

  const handleBlock = async () => {
    if (!activeMatchId || !user) return;
    try {
      // Find other user ID
      const match = matches.find(m => m.id === activeMatchId);
      const otherUid = match?.users.find(uid => uid !== user.id);

      if (otherUid) {
        await blockUser(user.id, otherUid, activeMatchId);
        // Update local block list immediately
        setBlockedUserIds(prev => new Set(prev).add(otherUid));
      }

      setActiveMatchId(null);
      setView(ViewState.MATCHES);
      setShowBlockConfirm(false);
    } catch (e) {
      console.error("Block failed:", e);
      alert("Failed to block. Please try again.");
    }
  };

  // --- MAIN APP LAYOUT ---
  return (
    <AuthGate>
      <div className="min-h-screen bg-stone-50 pb-20 max-w-md mx-auto relative shadow-2xl overflow-hidden border-x border-stone-100">

        {/* HEADER */}
        <header className="px-4 py-3 bg-white/80 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between border-b border-stone-100">
          {view === ViewState.CHAT && activeMatchId ? (
            <button onClick={() => { setView(ViewState.MATCHES); setActiveMatchId(null); }} className="p-2 -ml-2 rounded-full hover:bg-stone-100">
              <ChevronLeftIcon className="w-6 h-6 text-stone-600" />
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary-400 rounded-lg flex items-center justify-center">
                <span className="font-bold text-stone-900">F</span>
              </div>
              <h1 className="font-bold text-xl text-stone-800">FriendFind</h1>
            </div>
          )}
        </header>

        {/* VIEW CONTENT */}
        <main className="h-full">
          {view === ViewState.DISCOVER && (
            <div className="p-4 h-[calc(100vh-140px)] flex flex-col relative">
              {potentialFriends.length > 0 ? (
                <div className="flex-1 relative w-full h-full">
                  {/* BACKGROUND CARDS */}
                  {potentialFriends.length > 1 && (
                    <div className="absolute top-4 left-0 w-full h-full bg-white rounded-3xl shadow-sm scale-95 opacity-50 z-0"></div>
                  )}

                  {/* ACTIVE CARD */}
                  <div className="absolute top-0 left-0 w-full h-full bg-white rounded-3xl shadow-xl overflow-hidden z-10 flex flex-col">
                    <div className="h-3/5 relative">
                      <img
                        src={potentialFriends[0].avatar}
                        alt={potentialFriends[0].name}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/60 to-transparent p-4 pt-12">
                        <h2 className="text-white text-3xl font-bold">{potentialFriends[0].name}</h2>
                        <div className="flex items-center text-white/90 text-sm mt-1">
                          <MapPinIcon className="w-4 h-4 mr-1" />
                          {potentialFriends[0].city} • {potentialFriends[0].distance}km away
                        </div>
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex flex-wrap gap-2 mb-4">
                        {potentialFriends[0].interests.map(tag => (
                          <span key={tag} className="px-3 py-1 bg-stone-100 text-stone-600 text-xs rounded-full font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <p className="text-stone-600 leading-relaxed text-sm mb-4 line-clamp-3">
                        {potentialFriends[0].bio}
                      </p>

                      <div className="mt-auto grid grid-cols-2 gap-4">
                        <button
                          onClick={() => handleSwipe('left')}
                          className="flex items-center justify-center py-4 rounded-2xl border-2 border-stone-200 text-stone-400 hover:bg-stone-50 hover:border-stone-300 transition-colors"
                        >
                          <XIcon className="w-8 h-8" />
                        </button>
                        <button
                          onClick={() => handleSwipe('right')}
                          className="flex items-center justify-center py-4 rounded-2xl bg-accent-500 text-white hover:bg-accent-600 shadow-lg shadow-accent-500/30 transition-colors"
                        >
                          <HeartIcon className="w-8 h-8" fill="currentColor" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-stone-500">
                  <div className="w-20 h-20 bg-stone-200 rounded-full flex items-center justify-center mb-4">
                    <CompassIcon className="w-10 h-10 text-stone-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-stone-800">No more profiles</h3>
                  <p className="max-w-[200px]">Check back later for more potential friends nearby!</p>
                </div>
              )}
            </div>
          )}

          {view === ViewState.MATCHES && (
            <div className="p-4">
              <h2 className="text-2xl font-bold text-stone-900 mb-4">Your Matches</h2>
              {matches.length === 0 ? (
                <div className="text-center py-20 text-stone-400">
                  <p>No matches yet. Get swiping!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {matches.map(match => {
                    const otherUserId = match.users.find(id => id !== user?.id) || '';
                    const otherUser = otherUserProfiles[otherUserId] || { name: 'Unknown', avatar: 'https://via.placeholder.com/100' };

                    return (
                      <div
                        key={match.id}
                        onClick={() => { setActiveMatchId(match.id); setView(ViewState.CHAT); }}
                        className="flex items-center p-3 bg-white rounded-2xl shadow-sm border border-stone-100 cursor-pointer hover:bg-stone-50 transition-colors"
                      >
                        <img src={otherUser.avatar} className="w-14 h-14 rounded-full object-cover border border-stone-100" alt="avatar" />
                        <div className="ml-3 flex-1 overflow-hidden">
                          <div className="flex justify-between items-center mb-1">
                            <h3 className="font-semibold text-stone-900">{otherUser.name}</h3>
                            <span className="text-xs text-stone-400">
                              {match.lastMessageTime ? new Date(match.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                            </span>
                          </div>
                          <p className="text-sm text-stone-500 truncate">{match.lastMessage}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}



          {/* CHAT VIEW */}
          {
            view === ViewState.CHAT && activeMatchId && (
              <div className="flex flex-col h-[calc(100vh-65px)] bg-stone-50 relative">
                {/* Chat Header with Options */}
                <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-stone-100 shadow-sm z-20">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setActiveMatchId(null)} className="p-1 rounded-full hover:bg-stone-100">
                      <ChevronLeftIcon className="w-5 h-5 text-stone-600" />
                    </button>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const match = matches.find(m => m.id === activeMatchId);
                        const otherUid = match?.users.find(id => id !== user?.id);
                        const otherProfile = otherUid ? otherUserProfiles[otherUid] : null;

                        return (
                          <>
                            {otherProfile?.avatar ? (
                              <img src={otherProfile.avatar} className="w-9 h-9 rounded-full object-cover" />
                            ) : (
                              <div className="w-9 h-9 bg-primary-200 rounded-full flex items-center justify-center">
                                <span className="text-primary-700 font-bold">{otherProfile?.name?.[0] || "?"}</span>
                              </div>
                            )}
                            <h3 className="font-bold text-stone-900">{otherProfile?.name || "Chat"}</h3>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Safety Options Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setShowSafetyOptions(!showSafetyOptions)}
                      className="p-2 rounded-full hover:bg-stone-100 text-stone-400"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>

                    {showSafetyOptions && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowSafetyOptions(false)}></div>
                        <div className="absolute right-0 top-10 w-48 bg-white rounded-xl shadow-xl border border-stone-100 z-20 overflow-hidden py-1">
                          <button
                            onClick={() => { setShowUnmatchConfirm(true); setShowSafetyOptions(false); }}
                            className="w-full text-left px-4 py-3 text-stone-700 hover:bg-stone-50 text-sm font-medium flex items-center gap-2"
                          >
                            <XIcon className="w-4 h-4" /> Unmatch
                          </button>
                          <button
                            onClick={() => { setShowBlockConfirm(true); setShowSafetyOptions(false); }}
                            className="w-full text-left px-4 py-3 text-red-600 hover:bg-red-50 text-sm font-medium flex items-center gap-2 border-t border-stone-50"
                          >
                            <ShieldIcon className="w-4 h-4" /> Block & Report
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Safety Banner */}
                <div className="bg-orange-50 px-4 py-3 flex justify-between items-center border-b border-orange-100 shadow-sm z-10">
                  <div className="flex items-center gap-2">
                    <div className="bg-orange-200 p-1.5 rounded-full">
                      <CalendarIcon className="w-3 h-3 text-orange-700" />
                    </div>
                    <span className="text-xs text-orange-800 font-medium">Friendship Timeline</span>
                  </div>
                  <button
                    onClick={() => setShowSafetyModal(true)}
                    className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-full text-xs font-bold hover:bg-red-200 transition-colors shadow-sm"
                  >
                    <ShieldIcon className="w-3 h-3" />
                    Safety Alert
                  </button>
                </div>

                {/* Message List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Client-side match banner - shows correct name for each user */}
                  {activeMatchId && (() => {
                    const activeMatch = matches.find(m => m.id === activeMatchId);
                    if (activeMatch) {
                      const otherUserId = activeMatch.users.find(u => u !== user?.id);
                      const otherUserProfile = otherUserId ? otherUserProfiles[otherUserId] : null;
                      const otherUserName = otherUserProfile?.name || otherUserId || "your friend";
                      return (
                        <div className="flex justify-center">
                          <div className="bg-stone-200 text-stone-600 text-xs px-3 py-1 rounded-full text-center">
                            You matched with {otherUserName}!
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {(messages[activeMatchId] || []).map(msg => {
                    // Render Meetup Card if this message is linked to a meetup
                    if (msg.meetupId) {
                      const meetup = meetups[activeMatchId]?.find(m => m.id === msg.meetupId);
                      if (meetup) {
                        return (
                          <div key={msg.id} className="flex justify-center my-4">
                            <div className="bg-white rounded-2xl shadow-md border border-stone-100 p-4 w-full max-w-xs overflow-hidden">
                              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-stone-100">
                                <div className="bg-primary-400 p-2 rounded-lg">
                                  <CalendarIcon className="w-5 h-5 text-stone-900" />
                                </div>
                                <div>
                                  <span className="text-xs text-stone-500 font-bold uppercase tracking-wider">Meetup Plan</span>
                                  <h4 className="font-bold text-stone-900 leading-tight">Let's Meet Up!</h4>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="flex items-start gap-2">
                                  <MapPinIcon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                                  <p className="text-sm text-stone-700 font-medium">{meetup.place}</p>
                                </div>
                                <div className="flex items-start gap-2">
                                  <CalendarIcon className="w-4 h-4 text-stone-400 mt-0.5 shrink-0" />
                                  <p className="text-sm text-stone-700">{new Date(meetup.time).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                </div>
                                {meetup.status === 'proposed' && (
                                  <div className="pt-2 flex items-center gap-2">
                                    <div className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-md">
                                      Proposed
                                    </div>
                                    <button
                                      onClick={() => activeMatchId && updateMeetupStatus(activeMatchId, meetup.id, 'accepted')}
                                      className="px-3 py-1 bg-primary-400 text-stone-900 text-xs font-bold rounded-md hover:bg-primary-500 transition-colors"
                                    >
                                      Accept
                                    </button>
                                  </div>
                                )}
                                {meetup.status === 'accepted' && (
                                  <div className="pt-2">
                                    <div className="inline-block px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">
                                      Accepted
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      }
                    }

                    // Normal Message Rendering
                    // Check read status
                    const activeMatch = matches.find(m => m.id === activeMatchId);
                    const otherUserId = activeMatch?.users.find(u => u !== user?.id);
                    const isRead = otherUserId && activeMatch?.lastRead?.[otherUserId]
                      && activeMatch.lastRead[otherUserId] >= msg.timestamp;

                    return (
                      <div key={msg.id} className={`flex flex-col ${msg.isSystem ? 'items-center' : (msg.senderId === user?.id ? 'items-end' : 'items-start')}`}>
                        {msg.isSystem ? (
                          <div className="bg-stone-200 text-stone-600 text-xs px-3 py-1 rounded-full text-center max-w-[80%] whitespace-pre-wrap">
                            {msg.text}
                          </div>
                        ) : (
                          <>
                            <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${msg.senderId === user?.id
                              ? 'bg-primary-400 text-stone-900 rounded-tr-none'
                              : 'bg-white text-stone-800 shadow-sm border border-stone-100 rounded-tl-none'
                              }`}>
                              {msg.text}
                            </div>
                            {/* Read Receipt */}
                            {msg.senderId === user?.id && isRead && (
                              <div className="text-[10px] text-stone-400 font-medium px-1 mt-0.5">Read</div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                  <div className="h-4" />
                </div>

                {/* Input Area */}
                <div className="p-3 bg-white border-t border-stone-200">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowMeetupModal(true)}
                      className="p-3 text-stone-400 hover:text-accent-500 hover:bg-stone-50 rounded-xl transition-colors"
                      title="Plan Meetup"
                    >
                      <CalendarIcon className="w-6 h-6" />
                    </button>
                    <input
                      type="text"
                      value={inputMsg}
                      onChange={e => setInputMsg(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Type a message..."
                      className="flex-1 bg-stone-100 border-none rounded-xl px-4 focus:ring-2 focus:ring-primary-400 outline-none"
                    />
                    <button
                      onClick={handleSendMessage}
                      disabled={!inputMsg.trim()}
                      className="p-3 bg-primary-400 text-stone-900 rounded-xl hover:bg-primary-500 disabled:opacity-50 transition-colors"
                    >
                      <SendIcon className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                {/* Meetup Modal */}
                {showMeetupModal && (
                  <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
                      <h3 className="text-xl font-bold mb-4">Plan a Meetup</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-stone-600">Where?</label>
                          <input
                            type="text"
                            placeholder="e.g. Joe's Coffee Shop"
                            className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                            value={meetupForm.place}
                            onChange={e => setMeetupForm({ ...meetupForm, place: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium text-stone-600">When?</label>
                          <input
                            type="datetime-local"
                            className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                            value={meetupForm.time}
                            onChange={e => setMeetupForm({ ...meetupForm, time: e.target.value })}
                          />
                        </div>
                        <div className="flex gap-3 mt-6">
                          <Button variant="secondary" fullWidth onClick={() => setShowMeetupModal(false)}>Cancel</Button>
                          <Button fullWidth onClick={handleCreateMeetup}>Propose</Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Safety Modal */}
                {showSafetyModal && (
                  <div className="absolute inset-0 z-50 bg-red-500/90 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-2xl">
                      <div className="flex justify-center mb-4">
                        <div className="bg-red-100 p-4 rounded-full ring-4 ring-red-50">
                          <ShieldIcon className="w-10 h-10 text-red-600" />
                        </div>
                      </div>
                      <h3 className="text-2xl font-bold text-center text-red-600 mb-2">Safety Alert</h3>
                      <p className="text-center text-stone-600 mb-6 text-sm">
                        This will email your <strong>{user?.trustedContacts.length} Trusted Contacts</strong> with your current location and details about your match ({matches.find(m => m.id === activeMatchId) ? otherUserProfiles[matches.find(m => m.id === activeMatchId)?.users.find(id => id !== user?.id) || '']?.name : 'Unknown'}).
                      </p>

                      {alertStatus === 'sent' ? (
                        <div className="bg-green-100 text-green-800 p-4 rounded-xl text-center font-medium animate-in zoom-in duration-300">
                          Alert sent successfully.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <Button variant="danger" fullWidth size="lg" onClick={handleSafetyAlert} disabled={alertStatus === 'sending'}>
                            {alertStatus === 'sending' ? 'Composing & Sending...' : 'SEND ALERT NOW'}
                          </Button>
                          <Button variant="ghost" fullWidth onClick={() => setShowSafetyModal(false)}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          }

          {
            view === ViewState.PROFILE && (
              <div className="p-6">
                <div className="flex flex-col items-center mb-8">
                  {/* Remove (user as any) */}
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mb-4"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-primary-400 flex items-center justify-center border-4 border-white shadow-lg mb-4">
                      <UserIcon className="w-12 h-12 text-stone-900" />
                    </div>
                  )}
                  <h2 className="text-2xl font-bold text-stone-900">{auth.currentUser?.email ?? "Anonymous"}</h2>
                  <p className="text-stone-500">{user?.city ?? "Your City"}</p>
                  {/* Remove (user as any) */}
                  {user?.bio && (
                    <p className="text-stone-600 text-sm text-center mt-2 max-w-xs">{user.bio}</p>
                  )}
                </div>

                <div className="space-y-6">
                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-semibold mb-3">Edit Profile</h3>

                    <div className="space-y-3">
                      <div>
                        <label className="text-sm font-medium text-stone-600">City</label>
                        <input
                          className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                          value={profileCity}
                          onChange={(e) => setProfileCity(e.target.value)}
                          placeholder="e.g. Charlotte, NC"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-stone-600">Interests (comma separated)</label>
                        <input
                          className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                          value={profileInterests}
                          onChange={(e) => setProfileInterests(e.target.value)}
                          placeholder="e.g. guitar, hiking, coding"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-stone-600">Avatar URL</label>
                        <input
                          className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                          value={profileAvatar}
                          onChange={(e) => setProfileAvatar(e.target.value)}
                          placeholder="https://example.com/your-photo.jpg"
                        />
                        <p className="text-xs text-stone-500 mt-1">
                          Paste a direct link to an image (e.g. from Imgur, Gravatar, etc.)
                        </p>
                      </div>

                      <div>
                        <label className="text-sm font-medium text-stone-600">Bio</label>
                        <textarea
                          className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200 resize-none"
                          rows={3}
                          value={profileBio}
                          onChange={(e) => setProfileBio(e.target.value)}
                          placeholder="Tell others a bit about yourself..."
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium text-stone-600">Trusted Contacts (comma separated emails)</label>
                        <input
                          className="w-full mt-1 p-3 bg-stone-50 rounded-xl border border-stone-200"
                          value={profileContacts}
                          onChange={(e) => setProfileContacts(e.target.value)}
                          placeholder="e.g. spouse@email.com, friend@email.com"
                        />
                      </div>

                      <Button fullWidth onClick={handleSaveProfile} disabled={profileSaving}>
                        {profileSaving ? "Saving..." : "Save Profile"}
                      </Button>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-semibold mb-2">My Interests</h3>
                    <div className="flex flex-wrap gap-2">
                      {user?.interests.map(t => (
                        <span key={t} className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">{t}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-semibold mb-2">Trusted Contacts</h3>
                    <p className="text-sm text-stone-500 mb-3">These people will be notified if you use the Safety Alert.</p>
                    {user?.trustedContacts.map(email => (
                      <div key={email} className="flex items-center gap-2 text-sm text-stone-700 py-1 border-b border-stone-50 last:border-0">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        {email}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" fullWidth className="mt-3">Manage Contacts</Button>
                  </div>

                  <div className="bg-white p-4 rounded-2xl shadow-sm border border-stone-100">
                    <h3 className="font-semibold mb-2">Developer Tools</h3>
                    <p className="text-xs text-stone-500">Data now syncs from Firestore</p>
                  </div>

                  <LogoutButton />
                </div>
              </div>
            )
          }


        </main>

        {/* BOTTOM NAV */}
        {
          view !== ViewState.AUTH && view !== ViewState.CHAT && (
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 px-6 py-3 flex justify-between items-center z-40 max-w-md mx-auto">
              <button
                onClick={() => setView(ViewState.DISCOVER)}
                className={`flex flex-col items-center gap-1 ${view === ViewState.DISCOVER ? 'text-primary-500' : 'text-stone-400'}`}
              >
                <CompassIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">Discover</span>
              </button>

              <button
                onClick={() => setView(ViewState.MATCHES)}
                className={`flex flex-col items-center gap-1 ${view === ViewState.MATCHES ? 'text-primary-500' : 'text-stone-400'}`}
              >
                <MessageIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">Chats</span>
              </button>

              <button
                onClick={() => setView(ViewState.PROFILE)}
                className={`flex flex-col items-center gap-1 ${view === ViewState.PROFILE ? 'text-primary-500' : 'text-stone-400'}`}
              >
                <UserIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">Profile</span>
              </button>
            </nav>
          )
        }

        {/* Modals for Safety Actions */}
        {
          showUnmatchConfirm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-stone-900 mb-2">Unmatch?</h3>
                <p className="text-stone-600 mb-6">This will remove the match and delete your conversation. This action cannot be undone.</p>
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setShowUnmatchConfirm(false)}>Cancel</Button>
                  <Button fullWidth onClick={handleUnmatch} className="bg-red-500 hover:bg-red-600 text-white border-none">Yes, Unmatch</Button>
                </div>
              </div>
            </div>
          )
        }

        {
          showBlockConfirm && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <h3 className="text-xl font-bold text-stone-900 mb-2">Block User?</h3>
                <p className="text-stone-600 mb-6">They won't be able to see you or contact you again. This will also unmatch you.</p>
                <div className="flex gap-3">
                  <Button variant="outline" fullWidth onClick={() => setShowBlockConfirm(false)}>Cancel</Button>
                  <Button fullWidth onClick={handleBlock} className="bg-red-500 hover:bg-red-600 text-white border-none">Block User</Button>
                </div>
              </div>
            </div>
          )
        }
      </div >
    </AuthGate>
  );
};

export default App;
