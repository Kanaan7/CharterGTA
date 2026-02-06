'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, DollarSign, Clock, MessageCircle, Anchor, Star, Users, Send, X, Plus, LogOut } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy, getDocs, doc, updateDoc, setDoc } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { getStripe } from '../lib/stripe';

const LOCATIONS = ["All Locations", "Port Credit", "Toronto Harbour", "Hamilton Harbour"];

export default function BoatCharterPlatform() {
  const [view, setView] = useState('browse');
  const [userType, setUserType] = useState(null); // null = not logged in, 'user' or 'owner'
  const [boats, setBoats] = useState([]);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookings, setBookings] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [newBoat, setNewBoat] = useState({
    name: '',
    location: 'Port Credit',
    type: 'Sailboat',
    capacity: 4,
    price: 200,
    description: '',
    amenities: '',
    imageUrl: ''
  });

  // Check auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Check if user has a profile to determine their type
        const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', user.uid)));
        if (!userDoc.empty) {
          const userData = userDoc.docs[0].data();
          setUserType(userData.userType);
        }
      } else {
        setCurrentUser(null);
        setUserType(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch boats from Firestore
  useEffect(() => {
    const q = query(collection(db, 'boats'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const boatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBoats(boatsData);
    });

    return () => unsubscribe();
  }, []);

  // Fetch user's bookings
  useEffect(() => {
    if (!currentUser || userType !== 'user') return;

    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const bookingsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setBookings(bookingsData);
    });

    return () => unsubscribe();
  }, [currentUser, userType]);

  // Fetch conversations
  useEffect(() => {
    if (!currentUser) return;

    const q = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const conversationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setConversations(conversationsData);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversation) return;

    const q = query(
      collection(db, 'messages'),
      where('conversationId', '==', selectedConversation.id),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate()
      }));
      setMessages(messagesData);
    });

    return () => unsubscribe();
  }, [selectedConversation]);

  const handleGoogleSignIn = async (accountType) => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Create or update user profile
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        userType: accountType,
        createdAt: new Date()
      }, { merge: true });

      setUserType(accountType);
    } catch (error) {
      console.error('Sign in error:', error);
      alert('Error signing in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUserType(null);
      setView('browse');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const filteredBoats = locationFilter === 'All Locations' 
    ? boats 
    : boats.filter(boat => boat.location === locationFilter);

  const handleBooking = async () => {
    if (!selectedDate || !selectedSlot) {
      alert('Please select a date and time slot');
      return;
    }

    try {
      const response = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boatName: selectedBoat.name,
          boatId: selectedBoat.id,
          date: selectedDate,
          slot: selectedSlot,
          price: selectedBoat.price,
          userId: currentUser.uid,
          ownerEmail: selectedBoat.ownerEmail || 'owner@example.com'
        }),
      });

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Booking error:', error);
      alert('Error processing booking. Please try again.');
    }
  };

  const startConversation = async (boat) => {
    if (!currentUser) {
      alert('Please sign in to message the owner');
      return;
    }

    // Check if conversation already exists
    const existingConv = conversations.find(conv => 
      conv.boatId === boat.id && 
      conv.participantIds.includes(currentUser.uid) &&
      conv.participantIds.includes(boat.ownerId)
    );

    if (existingConv) {
      setSelectedConversation(existingConv);
      setView('messages');
      return;
    }

    // Create new conversation
    try {
      const convRef = await addDoc(collection(db, 'conversations'), {
        boatId: boat.id,
        boatName: boat.name,
        participantIds: [currentUser.uid, boat.ownerId],
        participantNames: {
          [currentUser.uid]: currentUser.displayName || 'User',
          [boat.ownerId]: boat.ownerName || 'Owner'
        },
        lastMessage: '',
        lastMessageTime: new Date(),
        createdAt: new Date()
      });

      const newConv = {
        id: convRef.id,
        boatId: boat.id,
        boatName: boat.name,
        participantIds: [currentUser.uid, boat.ownerId],
        participantNames: {
          [currentUser.uid]: currentUser.displayName || 'User',
          [boat.ownerId]: boat.ownerName || 'Owner'
        }
      };

      setSelectedConversation(newConv);
      setView('messages');
    } catch (error) {
      console.error('Error creating conversation:', error);
      alert('Error starting conversation. Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !currentUser || !selectedConversation) return;

    try {
      await addDoc(collection(db, 'messages'), {
        conversationId: selectedConversation.id,
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        text: messageInput,
        timestamp: new Date()
      });

      // Update conversation's last message
      await updateDoc(doc(db, 'conversations', selectedConversation.id), {
        lastMessage: messageInput,
        lastMessageTime: new Date()
      });

      setMessageInput('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const addNewBoat = async () => {
    if (!newBoat.name || !newBoat.description || !currentUser) {
      alert('Please fill in all required fields');
      return;
    }
    
    try {
      await addDoc(collection(db, 'boats'), {
        ...newBoat,
        ownerId: currentUser.uid,
        ownerName: currentUser.displayName || "Your Name",
        ownerEmail: currentUser.email || 'owner@example.com',
        amenities: newBoat.amenities.split(',').map(a => a.trim()).filter(a => a),
        rating: 0,
        reviews: 0,
        imageUrl: newBoat.imageUrl || "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80",
        availability: [
          { date: "2026-07-15", slots: ["09:00-13:00", "14:00-18:00"] },
          { date: "2026-07-16", slots: ["09:00-13:00", "14:00-18:00"] },
          { date: "2026-07-17", slots: ["09:00-13:00", "14:00-18:00"] }
        ],
        createdAt: new Date()
      });
      
      setView('owner-dashboard');
      setNewBoat({
        name: '',
        location: 'Port Credit',
        type: 'Sailboat',
        capacity: 4,
        price: 200,
        description: '',
        amenities: '',
        imageUrl: ''
      });
      alert('Boat listed successfully!');
    } catch (error) {
      console.error('Error adding boat:', error);
      alert('Error listing boat. Please try again.');
    }
  };

  // Login Screen
  if (!currentUser || !userType) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-sky-100">
            <div className="text-center mb-8">
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-4 rounded-2xl shadow-lg inline-block mb-4">
                <Anchor className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent mb-2">
                GTA Charter
              </h1>
              <p className="text-slate-600">Lake Ontario Adventures</p>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 text-center">
                  Welcome! Choose your account type:
                </h2>
              </div>

              <button
                onClick={() => handleGoogleSignIn('user')}
                className="w-full bg-white border-2 border-blue-200 hover:border-blue-400 text-slate-700 py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all hover:shadow-lg group"
              >
                <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-bold text-slate-900">Sign in as Passenger</div>
                  <div className="text-sm text-slate-500">Book and charter boats</div>
                </div>
              </button>

              <button
                onClick={() => handleGoogleSignIn('owner')}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 transition-all hover:shadow-xl group"
              >
                <div className="w-10 h-10 bg-white rounded-lg shadow flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <div className="font-bold">Sign in as Boat Owner</div>
                  <div className="text-sm opacity-90">List and manage your boats</div>
                </div>
              </button>

              <p className="text-center text-sm text-slate-500 mt-6">
                By signing in, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Anchor className="w-16 h-16 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600 text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-sky-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('browse')}>
              <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-xl shadow-lg">
                <Anchor className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent">
                  GTA Charter
                </h1>
                <p className="text-xs text-slate-600">Lake Ontario Adventures</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg">
                <img 
                  src={currentUser.photoURL || 'https://via.placeholder.com/40'} 
                  alt={currentUser.displayName}
                  className="w-8 h-8 rounded-full"
                />
                <div className="text-left">
                  <div className="text-sm font-semibold text-slate-900">{currentUser.displayName}</div>
                  <div className="text-xs text-slate-500 capitalize">{userType}</div>
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden md:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Bottom Navigation (Mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-sky-200 z-50 md:hidden">
        <div className="flex justify-around py-2">
          <button
            onClick={() => setView('browse')}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'browse' ? 'text-blue-600' : 'text-slate-600'}`}
          >
            <Anchor className="w-5 h-5" />
            <span className="text-xs font-medium">Browse</span>
          </button>
          {userType === 'user' ? (
            <>
              <button
                onClick={() => setView('my-bookings')}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'my-bookings' ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs font-medium">Bookings</span>
              </button>
              <button
                onClick={() => setView('messages')}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'messages' ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs font-medium">Messages</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setView('owner-dashboard')}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'owner-dashboard' ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <Calendar className="w-5 h-5" />
                <span className="text-xs font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => setView('list-boat')}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'list-boat' ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <Plus className="w-5 h-5" />
                <span className="text-xs font-medium">List Boat</span>
              </button>
              <button
                onClick={() => setView('messages')}
                className={`flex flex-col items-center gap-1 px-4 py-2 ${view === 'messages' ? 'text-blue-600' : 'text-slate-600'}`}
              >
                <MessageCircle className="w-5 h-5" />
                <span className="text-xs font-medium">Messages</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Desktop Navigation */}
      <nav className="hidden md:block bg-white/60 backdrop-blur-sm border-b border-sky-200">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            <button
              onClick={() => setView('browse')}
              className={`px-6 py-3 font-medium transition-all ${
                view === 'browse' 
                  ? 'text-blue-700 border-b-2 border-blue-600' 
                  : 'text-slate-600 hover:text-blue-600'
              }`}
            >
              Browse Boats
            </button>
            {userType === 'user' ? (
              <>
                <button
                  onClick={() => setView('my-bookings')}
                  className={`px-6 py-3 font-medium transition-all ${
                    view === 'my-bookings' 
                      ? 'text-blue-700 border-b-2 border-blue-600' 
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  My Bookings
                </button>
                <button
                  onClick={() => setView('messages')}
                  className={`px-6 py-3 font-medium transition-all ${
                    view === 'messages' 
                      ? 'text-blue-700 border-b-2 border-blue-600' 
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  Messages
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setView('owner-dashboard')}
                  className={`px-6 py-3 font-medium transition-all ${
                    view === 'owner-dashboard' 
                      ? 'text-blue-700 border-b-2 border-blue-600' 
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  Owner Dashboard
                </button>
                <button
                  onClick={() => setView('list-boat')}
                  className={`px-6 py-3 font-medium transition-all ${
                    view === 'list-boat' 
                      ? 'text-blue-700 border-b-2 border-blue-600' 
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  List New Boat
                </button>
                <button
                  onClick={() => setView('messages')}
                  className={`px-6 py-3 font-medium transition-all ${
                    view === 'messages' 
                      ? 'text-blue-700 border-b-2 border-blue-600' 
                      : 'text-slate-600 hover:text-blue-600'
                  }`}
                >
                  Messages
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Browse View */}
        {view === 'browse' && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Discover Your Perfect Charter</h2>
              <p className="text-slate-600">Explore premium boats across Lake Ontario's finest harbours</p>
            </div>

            {/* Location Filter */}
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {LOCATIONS.map(location => (
                <button
                  key={location}
                  onClick={() => setLocationFilter(location)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                    locationFilter === location
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-blue-50 border border-sky-200'
                  }`}
                >
                  {location}
                </button>
              ))}
            </div>

            {/* Boat Grid */}
            {filteredBoats.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-sky-100">
                <Anchor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No boats available yet</h3>
                <p className="text-slate-500">Check back soon for new listings!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBoats.map(boat => (
                  <div
                    key={boat.id}
                    onClick={() => {
                      setSelectedBoat(boat);
                      setView('boat-detail');
                    }}
                    className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer group border border-sky-100"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={boat.imageUrl || "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"}
                        alt={boat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-blue-700 shadow-md">
                        ${boat.price}/4hrs
                      </div>
                    </div>
                    <div className="p-5">
                      <h3 className="text-xl font-bold text-slate-900 mb-1">{boat.name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
                        <MapPin className="w-4 h-4" />
                        <span>{boat.location}</span>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold text-slate-900">{boat.rating || 0}</span>
                          <span className="text-slate-500 text-sm">({boat.reviews || 0})</span>
                        </div>
                        <div className="flex items-center gap-1 text-slate-600">
                          <Users className="w-4 h-4" />
                          <span className="text-sm">Up to {boat.capacity}</span>
                        </div>
                      </div>
                      <div className="text-sm text-slate-600 mb-3">{boat.type}</div>
                      <div className="pt-3 border-t border-sky-100">
                        <button className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-2 rounded-lg font-medium hover:shadow-lg transition-all">
                          View Details
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Boat Detail View */}
        {view === 'boat-detail' && selectedBoat && (
          <div>
            <button
              onClick={() => setView('browse')}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              ← Back to Browse
            </button>

            <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-sky-100">
              <img
                src={selectedBoat.imageUrl || "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"}
                alt={selectedBoat.name}
                className="w-full h-64 md:h-96 object-cover"
              />
              
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">{selectedBoat.name}</h2>
                    <div className="flex items-center gap-2 text-slate-600 mb-2">
                      <MapPin className="w-5 h-5" />
                      <span className="text-lg">{selectedBoat.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span className="font-semibold text-lg">{selectedBoat.rating || 0}</span>
                      <span className="text-slate-500">({selectedBoat.reviews || 0} reviews)</span>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600 to-cyan-600 text-white px-6 py-4 rounded-xl shadow-lg">
                    <div className="text-sm opacity-90">Starting at</div>
                    <div className="text-3xl font-bold">${selectedBoat.price}</div>
                    <div className="text-sm opacity-90">per 4 hours</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">About</h3>
                    <p className="text-slate-700 leading-relaxed mb-4">{selectedBoat.description}</p>
                    <div className="flex items-center gap-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        <span>Up to {selectedBoat.capacity} guests</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-3">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedBoat.amenities?.map((amenity, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200"
                        >
                          {amenity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {userType === 'user' && (
                  <div className="border-t border-sky-100 pt-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Book Your Charter</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Select Date
                        </label>
                        <select
                          value={selectedDate}
                          onChange={(e) => {
                            setSelectedDate(e.target.value);
                            setSelectedSlot('');
                          }}
                          className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">Choose a date</option>
                          {selectedBoat.availability?.map(avail => (
                            <option key={avail.date} value={avail.date}>
                              {new Date(avail.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Select Time Slot
                        </label>
                        <select
                          value={selectedSlot}
                          onChange={(e) => setSelectedSlot(e.target.value)}
                          disabled={!selectedDate}
                          className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white disabled:bg-slate-50 disabled:text-slate-400"
                        >
                          <option value="">Choose a time</option>
                          {selectedDate && selectedBoat.availability
                            ?.find(avail => avail.date === selectedDate)
                            ?.slots.map(slot => (
                              <option key={slot} value={slot}>{slot}</option>
                            ))
                          }
                        </select>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleBooking}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!selectedDate || !selectedSlot}
                      >
                        Book Now - ${selectedBoat.price}
                      </button>
                      <button
                        onClick={() => startConversation(selectedBoat)}
                        className="px-6 py-4 border-2 border-blue-600 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2"
                      >
                        <MessageCircle className="w-5 h-5" />
                        Message Owner
                      </button>
                    </div>
                  </div>
                )}

                {userType === 'owner' && selectedBoat.ownerId === currentUser.uid && (
                  <div className="border-t border-sky-100 pt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-blue-900 font-medium">This is your listing</p>
                      <p className="text-blue-700 text-sm">You can manage it from your dashboard</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* My Bookings View */}
        {view === 'my-bookings' && userType === 'user' && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">My Bookings</h2>
            
            {bookings.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-sky-100">
                <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No bookings yet</h3>
                <p className="text-slate-500 mb-6">Start exploring and book your first charter!</p>
                <button
                  onClick={() => setView('browse')}
                  className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all"
                >
                  Browse Boats
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map(booking => (
                  <div key={booking.id} className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">{booking.boatName}</h3>
                        <div className="space-y-1 text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            <span>{new Date(booking.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            <span>{booking.slot}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-600 mb-2">${booking.price}</div>
                        <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                          ✓ Confirmed
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages View */}
        {view === 'messages' && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Messages</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Conversations List */}
              <div className="md:col-span-1 bg-white rounded-2xl shadow-lg border border-sky-100 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
                  <h3 className="font-bold text-lg">Conversations</h3>
                </div>
                <div className="divide-y divide-sky-100 max-h-[600px] overflow-y-auto">
                  {conversations.length === 0 ? (
                    <div className="p-8 text-center">
                      <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 text-sm">No conversations yet</p>
                    </div>
                  ) : (
                    conversations.map(conv => {
                      const otherParticipantId = conv.participantIds.find(id => id !== currentUser.uid);
                      const otherParticipantName = conv.participantNames[otherParticipantId];
                      
                      return (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`w-full text-left p-4 hover:bg-blue-50 transition-all ${
                            selectedConversation?.id === conv.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                          }`}
                        >
                          <div className="font-semibold text-slate-900 mb-1">{conv.boatName}</div>
                          <div className="text-sm text-slate-600">with {otherParticipantName}</div>
                          {conv.lastMessage && (
                            <div className="text-xs text-slate-500 mt-1 truncate">{conv.lastMessage}</div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Messages Panel */}
              <div className="md:col-span-2 bg-white rounded-2xl shadow-lg border border-sky-100 overflow-hidden">
                {selectedConversation ? (
                  <div className="flex flex-col h-[600px]">
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
                      <h3 className="font-bold text-lg">{selectedConversation.boatName}</h3>
                      <p className="text-sm opacity-90">
                        with {selectedConversation.participantNames[
                          selectedConversation.participantIds.find(id => id !== currentUser.uid)
                        ]}
                      </p>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-12">
                          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map(msg => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.senderId === currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                          >
                            <div className={`max-w-[80%] md:max-w-[60%] ${
                              msg.senderId === currentUser?.uid
                                ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                                : 'bg-slate-100 text-slate-900' 
                            } rounded-2xl px-4 py-3`}>
                              <div className="font-medium text-sm mb-1 opacity-90">
                                {msg.senderName}
                              </div>
                              <div>{msg.text}</div>
                              <div className={`text-xs mt-1 ${msg.senderId === currentUser?.uid ? 'text-white/70' : 'text-slate-500'}`}>
                                {msg.timestamp?.toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                    
                    <div className="p-4 border-t border-sky-100">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                          placeholder="Type a message..."
                          className="flex-1 px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={sendMessage}
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-3 rounded-lg hover:shadow-lg transition-all"
                        >
                          <Send className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-[600px] flex items-center justify-center">
                    <div className="text-center">
                      <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-700 mb-2">Select a conversation</h3>
                      <p className="text-slate-500">Choose a conversation from the left to view messages</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Owner Dashboard */}
        {view === 'owner-dashboard' && userType === 'owner' && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Owner Dashboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Total Boats</h3>
                  <Anchor className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {boats.filter(b => b.ownerId === currentUser?.uid).length}
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Total Bookings</h3>
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">
                  {bookings.filter(b => 
                    boats.find(boat => boat.id === b.boatId && boat.ownerId === currentUser?.uid)
                  ).length}
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Messages</h3>
                  <MessageCircle className="w-8 h-8 text-cyan-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{conversations.length}</div>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-4">Your Boats</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boats.filter(b => b.ownerId === currentUser?.uid).map(boat => (
                <div key={boat.id} className="bg-white rounded-xl overflow-hidden shadow-lg border border-sky-100">
                  <img 
                    src={boat.imageUrl || "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80"} 
                    alt={boat.name} 
                    className="w-full h-40 object-cover" 
                  />
                  <div className="p-4">
                    <h4 className="font-bold text-lg text-slate-900 mb-2">{boat.name}</h4>
                    <div className="text-sm text-slate-600 mb-3">{boat.location}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-bold">${boat.price}/4hrs</span>
                      <button 
                        onClick={() => {
                          setSelectedBoat(boat);
                          setView('boat-detail');
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {boats.filter(b => b.ownerId === currentUser?.uid).length === 0 && (
                <div className="col-span-full bg-white rounded-xl p-12 text-center shadow-lg border border-sky-100">
                  <Anchor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">No boats listed yet</h3>
                  <p className="text-slate-500 mb-6">Start earning by listing your boat!</p>
                  <button
                    onClick={() => setView('list-boat')}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    List Your First Boat
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* List Boat View */}
        {view === 'list-boat' && userType === 'owner' && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">List Your Boat</h2>
            
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-sky-100">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Boat Name *
                  </label>
                  <input
                    type="text"
                    value={newBoat.name}
                    onChange={(e) => setNewBoat({...newBoat, name: e.target.value})}
                    placeholder="e.g., Summer Breeze"
                    className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Location *
                    </label>
                    <select
                      value={newBoat.location}
                      onChange={(e) => setNewBoat({...newBoat, location: e.target.value})}
                      className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Port Credit">Port Credit</option>
                      <option value="Toronto Harbour">Toronto Harbour</option>
                      <option value="Hamilton Harbour">Hamilton Harbour</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Boat Type *
                    </label>
                    <select
                      value={newBoat.type}
                      onChange={(e) => setNewBoat({...newBoat, type: e.target.value})}
                      className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    >
                      <option value="Sailboat">Sailboat</option>
                      <option value="Motor Yacht">Motor Yacht</option>
                      <option value="Pontoon">Pontoon</option>
                      <option value="Catamaran">Catamaran</option>
                      <option value="Speedboat">Speedboat</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Capacity (guests) *
                    </label>
                    <input
                      type="number"
                      value={newBoat.capacity}
                      onChange={(e) => setNewBoat({...newBoat, capacity: parseInt(e.target.value)})}
                      min="2"
                      max="50"
                      className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Price per 4 hours ($) *
                    </label>
                    <input
                      type="number"
                      value={newBoat.price}
                      onChange={(e) => setNewBoat({...newBoat, price: parseInt(e.target.value)})}
                      min="50"
                      step="10"
                      className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={newBoat.description}
                    onChange={(e) => setNewBoat({...newBoat, description: e.target.value})}
                    placeholder="Describe your boat, what makes it special, and what guests can expect..."
                    rows="4"
                    className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Amenities (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newBoat.amenities}
                    onChange={(e) => setNewBoat({...newBoat, amenities: e.target.value})}
                    placeholder="e.g., Life jackets, Cooler, Sound system, WiFi"
                    className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Image URL (optional)
                  </label>
                  <input
                    type="text"
                    value={newBoat.imageUrl}
                    onChange={(e) => setNewBoat({...newBoat, imageUrl: e.target.value})}
                    placeholder="https://example.com/boat-image.jpg"
                    className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={addNewBoat}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all"
                  >
                    List Boat
                  </button>
                  <button
                    onClick={() => setView('owner-dashboard')}
                    className="px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}