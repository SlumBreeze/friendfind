import React, { useState, useEffect } from 'react';
import { logOut } from './services/auth';
import { ViewState, User, PotentialFriend, Match, Message, Meetup } from './types';
import { Button } from './components/Button';
import {
  UserIcon, MessageIcon, CompassIcon, HeartIcon, XIcon, ShieldIcon,
  ChevronLeftIcon, CalendarIcon, SendIcon, MapPinIcon
} from './components/Icons';
import { generateIcebreakers, composeSafetyMessage } from './services/geminiService';
import {
  SEED_CURRENT_USER,
  SEED_POTENTIAL_FRIENDS,
  SEED_MATCHES,
  SEED_MATCHED_USERS_PROFILES,
  SEED_MESSAGES,
  SEED_MEETUPS
} from './services/seedData';
import AuthGate from './components/AuthGate';

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

  // --- INIT DATA ---
  const loadSeedData = () => {
    setUser(SEED_CURRENT_USER);
    setPotentialFriends(SEED_POTENTIAL_FRIENDS);
    setMatches(SEED_MATCHES);
    setMessages(SEED_MESSAGES);
    setMeetups(SEED_MEETUPS);

    // Index extra profiles for quick lookup
    const profiles: Record<string, PotentialFriend> = {};
    SEED_POTENTIAL_FRIENDS.forEach(p => profiles[p.id] = p);
    SEED_MATCHED_USERS_PROFILES.forEach(p => profiles[p.id] = p);
    setOtherUserProfiles(profiles);
  };

  // --- LOAD DATA ON MOUNT ---
  useEffect(() => {
    loadSeedData();
  }, []);

  // --- HELPERS ---
  const handleLogout = async () => {
    await logOut();
  };

  const handleSwipe = (direction: 'left' | 'right') => {
    if (potentialFriends.length === 0) return;
    const currentProfile = potentialFriends[0];

    if (direction === 'right') {
      const newMatchId = `match_${Date.now()}`;
      const newMatch: Match = {
        id: newMatchId,
        users: [user!.id, currentProfile.id],
        timestamp: Date.now(),
        lastMessage: "You matched! Say hi 👋",
        lastMessageTime: Date.now(),
      };

      setMatches(prev => [newMatch, ...prev]);

      // Add profile to lookup
      setOtherUserProfiles(prev => ({ ...prev, [currentProfile.id]: currentProfile }));

      // Initialize empty messages
      setMessages(prev => ({
        ...prev,
        [newMatchId]: [{
          id: `sys_${Date.now()}`,
          matchId: newMatchId,
          senderId: 'system',
          text: `You matched with ${currentProfile.name}!`,
          timestamp: Date.now(),
          isSystem: true
        }]
      }));

      // Trigger icebreaker generation in background
      generateIcebreakers(user!.interests, currentProfile.interests).then(breakers => {
        setMessages(prev => ({
          ...prev,
          [newMatchId]: [...(prev[newMatchId] || []), {
            id: 'sys_ice_' + Date.now(),
            matchId: newMatchId,
            senderId: 'system',
            text: `💡 Icebreaker ideas: \n${breakers.map(b => "• " + b).join('\n')}`,
            timestamp: Date.now() + 100,
            isSystem: true
          }]
        }));
      });
    }

    // Remove top card
    setPotentialFriends(prev => prev.slice(1));
  };

  const handleSendMessage = () => {
    if (!inputMsg.trim() || !activeMatchId) return;

    const newMessage: Message = {
      id: `msg_${Date.now()}`,
      matchId: activeMatchId,
      senderId: user!.id,
      text: inputMsg,
      timestamp: Date.now()
    };

    setMessages(prev => ({
      ...prev,
      [activeMatchId]: [...(prev[activeMatchId] || []), newMessage]
    }));

    // Update match last message
    setMatches(prev => prev.map(m =>
      m.id === activeMatchId
        ? { ...m, lastMessage: inputMsg, lastMessageTime: Date.now() }
        : m
    ));

    setInputMsg('');

    // Simulate reply from "Gemini" or Bot
    setTimeout(() => {
      const reply: Message = {
        id: `msg_${Date.now()}_reply`,
        matchId: activeMatchId,
        senderId: 'other',
        text: "That sounds awesome! I'd love to hear more about it.",
        timestamp: Date.now()
      };
      setMessages(prev => ({
        ...prev,
        [activeMatchId]: [...(prev[activeMatchId] || []), reply]
      }));
      setMatches(prev => prev.map(m =>
        m.id === activeMatchId
          ? { ...m, lastMessage: reply.text, lastMessageTime: Date.now() }
          : m
      ));
    }, 2000);
  };

  const handleCreateMeetup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMatchId || !meetupForm.place || !meetupForm.time) return;

    const newMeetup: Meetup = {
      id: `meet_${Date.now()}`,
      matchId: activeMatchId,
      place: meetupForm.place,
      time: meetupForm.time,
      status: 'proposed'
    };

    setMeetups(prev => ({
      ...prev,
      [activeMatchId]: [...(prev[activeMatchId] || []), newMeetup]
    }));

    // Add system message linked to meetup
    const sysMsg: Message = {
      id: `sys_meet_${Date.now()}`,
      matchId: activeMatchId,
      senderId: 'system',
      text: `Meetup Proposed`,
      timestamp: Date.now(),
      isSystem: true,
      meetupId: newMeetup.id
    };

    setMessages(prev => ({
      ...prev,
      [activeMatchId]: [...(prev[activeMatchId] || []), sysMsg]
    }));

    setShowMeetupModal(false);
    setMeetupForm({ place: '', time: '' });
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
                  <Button variant="outline" className="mt-6" onClick={() => loadSeedData()}>
                    Reset Data
                  </Button>
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

          {view === ViewState.CHAT && activeMatchId && (
            <div className="flex flex-col h-[calc(100vh-65px)] bg-stone-50 relative">
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
                                <div className="pt-2">
                                  <div className="inline-block px-2 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded-md">
                                    Proposed
                                  </div>
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
                  return (
                    <div key={msg.id} className={`flex ${msg.isSystem ? 'justify-center' : (msg.senderId === user?.id ? 'justify-end' : 'justify-start')}`}>
                      {msg.isSystem ? (
                        <div className="bg-stone-200 text-stone-600 text-xs px-3 py-1 rounded-full text-center max-w-[80%] whitespace-pre-wrap">
                          {msg.text}
                        </div>
                      ) : (
                        <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${msg.senderId === user?.id
                          ? 'bg-primary-400 text-stone-900 rounded-tr-none'
                          : 'bg-white text-stone-800 shadow-sm border border-stone-100 rounded-tl-none'
                          }`}>
                          {msg.text}
                        </div>
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
          )}

          {view === ViewState.PROFILE && (
            <div className="p-6">
              <div className="flex flex-col items-center mb-8">
                <img src={user?.avatar} alt="Me" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg mb-4" />
                <h2 className="text-2xl font-bold text-stone-900">{user?.name}</h2>
                <p className="text-stone-500">{user?.city}</p>
              </div>

              <div className="space-y-6">
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
                  <Button variant="outline" fullWidth onClick={loadSeedData}>Reset / Seed Data</Button>
                </div>

                <Button variant="secondary" fullWidth onClick={handleLogout}>Log Out</Button>
              </div>
            </div>
          )}
        </main>

        {/* BOTTOM NAV */}
        {view !== ViewState.AUTH && view !== ViewState.CHAT && (
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
        )}
      </div>
    </AuthGate>
  );
};

export default App;