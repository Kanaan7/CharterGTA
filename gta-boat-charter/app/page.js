'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, DollarSign, Clock, MessageCircle, Anchor, Star, Users, Send, X, Plus, LogOut, LogIn, ChevronLeft, ChevronRight } from 'lucide-react';
import { db, auth } from '../lib/firebase';
import {collection, addDoc, query,  where, onSnapshot, orderBy, getDocs, doc,updateDoc, setDoc,getDoc, serverTimestamp  } from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';

const LOCATIONS = ["All Locations", "Port Credit", "Toronto Harbour", "Hamilton Harbour"];

// Modern Date Picker Component
function DatePicker({ selectedDate, onSelectDate, availableDates }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };
  
  const isDateAvailable = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return availableDates.some(avail => avail.date === dateStr && avail.slots.length > 0);
  };
  
  const isDateSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toISOString().split('T')[0] === selectedDate;
  };
  
  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  
  return (
    <div className="bg-white rounded-xl border border-sky-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h3 className="font-semibold text-slate-900">{monthName}</h3>
        <button
          onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div key={day} className="text-center text-xs font-semibold text-slate-500 py-2">
            {day}
          </div>
        ))}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          const available = isDateAvailable(date);
          const selected = isDateSelected(date);
          const isPast = date && date < new Date(new Date().setHours(0, 0, 0, 0));
          
          return (
            <button
              key={idx}
              onClick={() => date && available && !isPast && onSelectDate(date.toISOString().split('T')[0])}
              disabled={!date || !available || isPast}
              className={`
                aspect-square p-2 rounded-lg text-sm font-medium transition-all
                ${!date ? 'invisible' : ''}
                ${selected ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105' : ''}
                ${available && !selected && !isPast ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' : ''}
                ${!available && date && !isPast ? 'text-slate-300 cursor-not-allowed' : ''}
                ${isPast && date ? 'text-slate-200 cursor-not-allowed line-through' : ''}
              `}
            >
              {date?.getDate()}
            </button>
          );
        })}
      </div>
      
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-sky-100 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-blue-50 border border-blue-200 rounded"></div>
          <span className="text-slate-600">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-600 to-cyan-600 rounded"></div>
          <span className="text-slate-600">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-slate-100 rounded"></div>
          <span className="text-slate-600">Unavailable</span>
        </div>
      </div>
    </div>
  );
}

// Auth Modal Component
function AuthModal({ onClose, onSignIn }){
  const [mode, setMode] = useState("login"); // login | signup
  const [role, setRole] = useState("user"); // user | owner
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailAuth = async () => {
    try {
      setLoading(true);

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }

      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">

      <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-xl space-y-6">

        {/* Header */}
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-gray-500 text-sm">
            GTA Charter Booking Portal
          </p>
        </div>

        {/* Role selector */}
        <div className="flex gap-2">
          <button
            onClick={() => setRole("user")}
            className={`flex-1 py-2 rounded-lg border ${
              role === "user"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300"
            }`}
          >
            Passenger
          </button>

          <button
            onClick={() => setRole("owner")}
            className={`flex-1 py-2 rounded-lg border ${
              role === "owner"
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300"
            }`}
          >
            Boat Owner
          </button>
        </div>

        {/* Email inputs */}
        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email address"
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {/* Email button */}
        <button
          onClick={handleEmailAuth}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium transition"
        >
          {loading
            ? "Please wait..."
            : mode === "login"
            ? "Sign In"
            : "Create Account"}
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="h-px bg-gray-300 flex-1" />
          OR
          <div className="h-px bg-gray-300 flex-1" />
        </div>

        {/* Google login */}
        <button
          onClick={() => onSignIn(role)}
          className="w-full border rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-gray-50"
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            className="w-5 h-5"
          />
          Continue with Google
        </button>

        {/* Switch login/signup */}
        <p className="text-center text-sm text-gray-600">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}
          <span
            onClick={() =>
              setMode(mode === "login" ? "signup" : "login")
            }
            className="text-blue-600 ml-1 cursor-pointer font-medium"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-full text-gray-500 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
export default function BoatCharterPlatform() {
  const [view, setView] = useState('browse');
  const [currentUserType, setCurrentUserType] = useState(null); // Current active mode
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
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (user) {
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const profile = userDoc.data();
          setUserProfile(profile);
          // Set current user type to their last used type or default
          setCurrentUserType(profile.lastActiveType || profile.accountTypes?.[0] || 'user');
        }
      } else {
        setUserProfile(null);
        setCurrentUserType(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch boats
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
    if (!currentUser) return;

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
  }, [currentUser]);

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

  // Fetch messages
 useEffect(() => {
  if (!selectedConversation) return;

  const q = query(
    collection(db, 'conversations', selectedConversation.id, 'messages'),
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

      // Get existing profile or create new one
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      let accountTypes = [accountType];
      
      if (userDoc.exists()) {
        const existingTypes = userDoc.data().accountTypes || [];
        // Add new account type if not already present
        accountTypes = [...new Set([...existingTypes, accountType])];
      }

      // Create or update user profile
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        accountTypes: accountTypes, // Array of account types user has
        lastActiveType: accountType, // Track which type they last used
        createdAt: userDoc.exists() ? userDoc.data().createdAt : new Date()
      }, { merge: true });

      setCurrentUserType(accountType);
      setShowAuthModal(false);
    } catch (error) {
      console.error('Sign in error:', error);
      if (error.code === 'auth/popup-closed-by-user') {
        // User closed popup, don't show error
        return;
      }
      alert('Error signing in. Please try again.');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setCurrentUserType(null);
      setView('browse');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const switchAccountType = async (newType) => {
    if (!currentUser || !userProfile) return;
    
    // Update last active type
    await updateDoc(doc(db, 'users', currentUser.uid), {
      lastActiveType: newType
    });
    
    setCurrentUserType(newType);
    setView('browse');
  };

  const filteredBoats = locationFilter === 'All Locations' 
    ? boats 
    : boats.filter(boat => boat.location === locationFilter);

  const handleBooking = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

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

      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Error processing booking. Please try again.');
    }
  };

  const startConversation = async (boat) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

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
    // ✅ store inside conversation subcollection
    await addDoc(
      collection(db, 'conversations', selectedConversation.id, 'messages'),
      {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || 'User',
        text: messageInput,
        timestamp: serverTimestamp()
      }
    );

    // update last message preview
    await updateDoc(doc(db, 'conversations', selectedConversation.id), {
      lastMessage: messageInput,
      lastMessageTime: serverTimestamp()
    });

    setMessageInput('');
  } catch (error) {
    console.error('Error sending message:', error);
  }
};


  const addNewBoat = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (!newBoat.name || !newBoat.description) {
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
          { date: "2026-07-17", slots: ["09:00-13:00", "14:00-18:00"] },
          { date: "2026-07-20", slots: ["09:00-13:00", "14:00-18:00"] },
          { date: "2026-07-21", slots: ["09:00-13:00", "14:00-18:00"] }
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
      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal 
          onClose={() => setShowAuthModal(false)}
          onSignIn={handleGoogleSignIn}
        />
      )}

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
              {currentUser ? (
                <>
                  {/* Account Type Switcher - only show if user has multiple account types */}
                  {userProfile?.accountTypes?.length > 1 && (
                    <select
                      value={currentUserType}
                      onChange={(e) => switchAccountType(e.target.value)}
                      className="px-3 py-2 bg-white border border-sky-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {userProfile.accountTypes.map(type => (
                        <option key={type} value={type}>
                          {type === 'user' ? '👤 Passenger' : '⚓ Owner'}
                        </option>
                      ))}
                    </select>
                  )}
                  
                  <div className="hidden md:flex items-center gap-2 bg-slate-100 px-3 py-2 rounded-lg">
                    <img 
                      src={currentUser.photoURL || 'https://via.placeholder.com/40'} 
                      alt={currentUser.displayName}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-900">{currentUser.displayName}</div>
                      <div className="text-xs text-slate-500 capitalize">{currentUserType}</div>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="hidden md:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              )}
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
          {currentUser && currentUserType === 'user' && (
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
          )}
          {currentUser && currentUserType === 'owner' && (
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
            {currentUser && currentUserType === 'user' && (
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
            )}
            {currentUser && currentUserType === 'owner' && (
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
                <p className="text-slate-500 mb-6">Check back soon for new listings!</p>
                {currentUser && currentUserType === 'owner' && (
                  <button
                    onClick={() => setView('list-boat')}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-all"
                  >
                    List Your First Boat
                  </button>
                )}
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

                {(!currentUser || currentUserType === 'user') && (
                  <div className="border-t border-sky-100 pt-6">
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Book Your Charter</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                          Select Date
                        </label>
                        <DatePicker 
                          selectedDate={selectedDate}
                          onSelectDate={(date) => {
                            setSelectedDate(date);
                            setSelectedSlot('');
                          }}
                          availableDates={selectedBoat.availability || []}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-3">
                          Select Time Slot
                        </label>
                        {selectedDate ? (
                          <div className="space-y-2">
                            {selectedBoat.availability
                              ?.find(avail => avail.date === selectedDate)
                              ?.slots.map(slot => (
                                <button
                                  key={slot}
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                                    selectedSlot === slot
                                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md'
                                      : 'bg-white border-2 border-sky-200 text-slate-700 hover:border-blue-400'
                                  }`}
                                >
                                  <div className="flex items-center justify-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {slot}
                                  </div>
                                </button>
                              ))
                            }
                          </div>
                        ) : (
                          <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
                            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-slate-500">Select a date to view available times</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleBooking}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={!selectedDate || !selectedSlot}
                      >
                        {currentUser ? `Book Now - $${selectedBoat.price}` : 'Sign In to Book'}
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

                {currentUser && currentUserType === 'owner' && selectedBoat.ownerId === currentUser.uid && (
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

        {/* My Bookings View - Only show if logged in as user */}
        {view === 'my-bookings' && currentUser && currentUserType === 'user' && (
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

        {/* Messages View - Show for logged in users */}
        {view === 'messages' && currentUser && (
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

        {/* Owner Dashboard - Only show if logged in as owner */}
        {view === 'owner-dashboard' && currentUser && currentUserType === 'owner' && (
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

        {/* List Boat View - Only show if logged in as owner */}
        {view === 'list-boat' && currentUser && currentUserType === 'owner' && (
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