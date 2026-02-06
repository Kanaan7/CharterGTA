"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Calendar,
  MapPin,
  Clock,
  MessageCircle,
  Anchor,
  Star,
  Users,
  Send,
  Plus,
  LogOut,
  LogIn,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { db, auth } from "../lib/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";

const LOCATIONS = ["All Locations", "Port Credit", "Toronto Harbour", "Hamilton Harbour"];

/* --------------------------- DatePicker --------------------------- */
function DatePicker({ selectedDate, onSelectDate, availableDates }) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const first = availableDates?.[0]?.date;
    return first ? new Date(first + "T00:00:00") : new Date();
  });

  // if boat changes, re-center calendar
  useEffect(() => {
    const first = availableDates?.[0]?.date;
    if (first) setCurrentMonth(new Date(first + "T00:00:00"));
  }, [availableDates]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    for (let i = 0; i < startingDayOfWeek; i++) days.push(null);
    for (let day = 1; day <= daysInMonth; day++) days.push(new Date(year, month, day));
    return days;
  };

  const isDateAvailable = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split("T")[0];
    return (availableDates || []).some((a) => a.date === dateStr && (a.slots || []).length > 0);
  };

  const isDateSelected = (date) => {
    if (!date || !selectedDate) return false;
    return date.toISOString().split("T")[0] === selectedDate;
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
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
              onClick={() => date && available && !isPast && onSelectDate(date.toISOString().split("T")[0])}
              disabled={!date || !available || isPast}
              className={`
                aspect-square p-2 rounded-lg text-sm font-medium transition-all
                ${!date ? "invisible" : ""}
                ${selected ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg scale-105" : ""}
                ${available && !selected && !isPast ? "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" : ""}
                ${!available && date && !isPast ? "text-slate-300 cursor-not-allowed" : ""}
                ${isPast && date ? "text-slate-200 cursor-not-allowed line-through" : ""}
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

/* --------------------------- Auth Modal --------------------------- */
function AuthModal({ onClose, onGoogle, onEmailAuth }) {
  const [mode, setMode] = useState("login"); // login | signup
  const [role, setRole] = useState("user"); // user | owner
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-8 shadow-xl space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold">{mode === "login" ? "Welcome Back" : "Create Account"}</h2>
          <p className="text-gray-500 text-sm">GTA Charter Booking Portal</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setRole("user")}
            className={`flex-1 py-2 rounded-lg border ${
              role === "user" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"
            }`}
          >
            Passenger
          </button>

          <button
            onClick={() => setRole("owner")}
            className={`flex-1 py-2 rounded-lg border ${
              role === "owner" ? "bg-blue-600 text-white border-blue-600" : "border-gray-300"
            }`}
          >
            Boat Owner
          </button>
        </div>

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

        <button
          onClick={() => onEmailAuth({ mode, role, email, password })}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium transition"
        >
          {mode === "login" ? "Sign In" : "Create Account"}
        </button>

        <div className="flex items-center gap-3 text-gray-400 text-sm">
          <div className="h-px bg-gray-300 flex-1" />
          OR
          <div className="h-px bg-gray-300 flex-1" />
        </div>

        <button
          onClick={() => onGoogle(role)}
          className="w-full border rounded-lg py-2 flex items-center justify-center gap-2 hover:bg-gray-50"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="google" />
          Continue with Google
        </button>

        <p className="text-center text-sm text-gray-600">
          {mode === "login" ? "Don't have an account?" : "Already have an account?"}{" "}
          <span
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-blue-600 cursor-pointer font-medium"
          >
            {mode === "login" ? "Sign up" : "Sign in"}
          </span>
        </p>

        <button onClick={onClose} className="w-full text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* --------------------------- Main Page --------------------------- */
export default function BoatCharterPlatform() {
  const [view, setView] = useState("browse");

  const [boats, setBoats] = useState([]);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [locationFilter, setLocationFilter] = useState("All Locations");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // messaging
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");

  // owner list boat
  const [newBoat, setNewBoat] = useState({
    name: "",
    location: "Port Credit",
    type: "Sailboat",
    capacity: 4,
    price: 200,
    description: "",
    amenities: "",
    imageUrl: "",
  });

  /* -------- Auth state -------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setCurrentUser(u || null);

      if (u) {
        const userRef = doc(db, "users", u.uid);
        const snap = await getDoc(userRef);

        if (snap.exists()) {
          const profile = snap.data();
          setUserProfile(profile);
          setCurrentUserType(profile.lastActiveType || profile.accountTypes?.[0] || "user");
        } else {
          // if user exists in Auth but not Firestore, create profile
          const fallbackType = "user";
          await setDoc(
            userRef,
            {
              uid: u.uid,
              email: u.email || "",
              displayName: u.displayName || (u.email ? u.email.split("@")[0] : "User"),
              photoURL: u.photoURL || "",
              accountTypes: [fallbackType],
              lastActiveType: fallbackType,
              createdAt: serverTimestamp(),
            },
            { merge: true }
          );
          setCurrentUserType(fallbackType);
        }
      } else {
        setUserProfile(null);
        setCurrentUserType(null);
      }

      setLoading(false);
    });

    return () => unsub();
  }, []);

  /* -------- Boats -------- */
  useEffect(() => {
    const q = query(collection(db, "boats"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setBoats(data);
      },
      (err) => console.error("boats snapshot error:", err)
    );

    return () => unsub();
  }, []);

  const filteredBoats = useMemo(() => {
    if (locationFilter === "All Locations") return boats;
    return boats.filter((b) => b.location === locationFilter);
  }, [boats, locationFilter]);

  /* -------- Conversations -------- */
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, "conversations"), where("participantIds", "array-contains", currentUser.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setConversations(data);
      },
      (err) => console.error("conversations snapshot error:", err)
    );

    return () => unsub();
  }, [currentUser]);

  /* -------- Messages (subcollection) -------- */
  useEffect(() => {
    if (!selectedConversation) return;

    const q = query(
      collection(db, "conversations", selectedConversation.id, "messages"),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const data = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            ...raw,
            timestamp: raw.timestamp?.toDate ? raw.timestamp.toDate() : null,
          };
        });
        setMessages(data);
      },
      (err) => console.error("messages snapshot error:", err)
    );

    return () => unsub();
  }, [selectedConversation]);

  /* ---------------- Auth Handlers ---------------- */
  const upsertUserProfile = async (user, accountType) => {
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    const existingTypes = snap.exists() ? snap.data().accountTypes || [] : [];
    const accountTypes = Array.from(new Set([...existingTypes, accountType]));

    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
        photoURL: user.photoURL || "",
        accountTypes,
        lastActiveType: accountType,
        createdAt: snap.exists() ? snap.data().createdAt : serverTimestamp(),
      },
      { merge: true }
    );
  };

  const handleGoogleSignIn = async (accountType) => {
    try {
      const provider = new GoogleAuthProvider();
      const res = await signInWithPopup(auth, provider);
      await upsertUserProfile(res.user, accountType);
      setShowAuthModal(false);
    } catch (e) {
      if (e?.code === "auth/popup-closed-by-user") return;
      console.error("google sign in error:", e);
      alert(e.message);
    }
  };

  const handleEmailAuth = async ({ mode, role, email, password }) => {
    try {
      if (!email || !password) return alert("Enter email + password");

      let userCred;
      if (mode === "login") userCred = await signInWithEmailAndPassword(auth, email, password);
      else userCred = await createUserWithEmailAndPassword(auth, email, password);

      await upsertUserProfile(userCred.user, role);
      setShowAuthModal(false);
    } catch (e) {
      console.error("email auth error:", e);
      alert(e.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setView("browse");
    setSelectedConversation(null);
    setSelectedBoat(null);
  };

  const switchAccountType = async (newType) => {
    if (!currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { lastActiveType: newType });
    setCurrentUserType(newType);
    setView("browse");
  };

  /* ---------------- Messaging ---------------- */
  const startConversation = async (boat) => {
    if (!currentUser) return setShowAuthModal(true);
    if (!boat?.ownerId) return alert("This boat is missing ownerId. Re-list the boat.");

    const existing = conversations.find(
      (c) =>
        c.boatId === boat.id &&
        c.participantIds?.includes(currentUser.uid) &&
        c.participantIds?.includes(boat.ownerId)
    );

    if (existing) {
      setSelectedConversation(existing);
      setView("messages");
      return;
    }

    try {
      const convRef = await addDoc(collection(db, "conversations"), {
        boatId: boat.id,
        boatName: boat.name,
        participantIds: [currentUser.uid, boat.ownerId],
        participantNames: {
          [currentUser.uid]: currentUser.displayName || "User",
          [boat.ownerId]: boat.ownerName || "Owner",
        },
        lastMessage: "",
        lastMessageTime: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      const newConv = {
        id: convRef.id,
        boatId: boat.id,
        boatName: boat.name,
        participantIds: [currentUser.uid, boat.ownerId],
        participantNames: {
          [currentUser.uid]: currentUser.displayName || "User",
          [boat.ownerId]: boat.ownerName || "Owner",
        },
      };

      setSelectedConversation(newConv);
      setView("messages");
    } catch (e) {
      console.error("startConversation error:", e);
      alert(e.message);
    }
  };

  const sendMessage = async () => {
    if (!messageInput.trim() || !currentUser || !selectedConversation) return;

    try {
      await addDoc(collection(db, "conversations", selectedConversation.id, "messages"), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "User",
        text: messageInput.trim(),
        timestamp: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", selectedConversation.id), {
        lastMessage: messageInput.trim(),
        lastMessageTime: serverTimestamp(),
      });

      setMessageInput("");
    } catch (e) {
      console.error("sendMessage error:", e);
      alert(e.message); // IMPORTANT so you SEE permission-denied, etc.
    }
  };

  /* ---------------- Owner: Add Boat ---------------- */
  const addNewBoat = async () => {
    if (!currentUser) return setShowAuthModal(true);
    if (currentUserType !== "owner") return alert("Switch to Owner mode to list boats.");
    if (!newBoat.name || !newBoat.description) return alert("Fill boat name + description");

    try {
      const amenitiesArr = (newBoat.amenities || "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      // You can edit later to real availability.
      const today = new Date();
      const plus = (n) => {
        const d = new Date(today);
        d.setDate(d.getDate() + n);
        return d.toISOString().split("T")[0];
      };

      await addDoc(collection(db, "boats"), {
        name: newBoat.name,
        location: newBoat.location,
        type: newBoat.type,
        capacity: Number(newBoat.capacity),
        price: Number(newBoat.price),
        description: newBoat.description,
        amenities: amenitiesArr,
        imageUrl:
          newBoat.imageUrl ||
          "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80",
        ownerId: currentUser.uid,
        ownerName: currentUser.displayName || "Owner",
        ownerEmail: currentUser.email || "",
        rating: 0,
        reviews: 0,
        availability: [
          { date: plus(1), slots: ["09:00-13:00", "14:00-18:00"] },
          { date: plus(2), slots: ["09:00-13:00", "14:00-18:00"] },
          { date: plus(3), slots: ["09:00-13:00", "14:00-18:00"] },
        ],
        createdAt: serverTimestamp(),
      });

      setNewBoat({
        name: "",
        location: "Port Credit",
        type: "Sailboat",
        capacity: 4,
        price: 200,
        description: "",
        amenities: "",
        imageUrl: "",
      });

      alert("Boat listed!");
      setView("browse");
    } catch (e) {
      console.error("addNewBoat error:", e);
      alert(e.message);
    }
  };

  /* ---------------- UI ---------------- */
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
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onGoogle={handleGoogleSignIn}
          onEmailAuth={handleEmailAuth}
        />
      )}

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-sky-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView("browse")}>
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
                  {userProfile?.accountTypes?.length > 1 && (
                    <select
                      value={currentUserType || "user"}
                      onChange={(e) => switchAccountType(e.target.value)}
                      className="px-3 py-2 bg-white border border-sky-200 rounded-lg text-sm font-medium text-slate-700"
                    >
                      {userProfile.accountTypes.map((t) => (
                        <option key={t} value={t}>
                          {t === "user" ? "👤 Passenger" : "⚓ Owner"}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => setView("messages")}
                    className="px-4 py-2 bg-white border border-sky-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Messages
                  </button>

                  {currentUserType === "owner" && (
                    <button
                      onClick={() => setView("list-boat")}
                      className="px-4 py-2 bg-white border border-sky-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> List Boat
                    </button>
                  )}

                  <button
                    onClick={handleSignOut}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" /> Sign In
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 pb-24 md:pb-6">
        {/* Browse */}
        {view === "browse" && (
          <div>
            <div className="mb-6">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Discover Your Perfect Charter</h2>
              <p className="text-slate-600">Explore premium boats across Lake Ontario's finest harbours</p>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  onClick={() => setLocationFilter(loc)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-all ${
                    locationFilter === loc
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                      : "bg-white text-slate-700 hover:bg-blue-50 border border-sky-200"
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>

            {filteredBoats.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-sky-100">
                <Anchor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No boats available yet</h3>
                <p className="text-slate-500 mb-6">List one as an Owner to test availability + chat.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBoats.map((boat) => (
                  <div
                    key={boat.id}
                    onClick={() => {
                      setSelectedBoat(boat);
                      setSelectedDate("");
                      setSelectedSlot("");
                      setView("boat-detail");
                    }}
                    className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all cursor-pointer group border border-sky-100"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={
                          boat.imageUrl ||
                          "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"
                        }
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

        {/* Boat Detail */}
        {view === "boat-detail" && selectedBoat && (
          <div>
            <button
              onClick={() => setView("browse")}
              className="mb-4 text-blue-600 hover:text-blue-700 font-medium flex items-center gap-2"
            >
              ← Back to Browse
            </button>

            <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-sky-100">
              <img
                src={
                  selectedBoat.imageUrl ||
                  "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"
                }
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
                      {(selectedBoat.amenities || []).map((a, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium border border-blue-200"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-sky-100 pt-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-4">Book Your Charter</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Select Date</label>
                      <DatePicker
                        selectedDate={selectedDate}
                        onSelectDate={(d) => {
                          setSelectedDate(d);
                          setSelectedSlot("");
                        }}
                        availableDates={selectedBoat.availability || []}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Select Time Slot</label>

                      {selectedDate ? (
                        <div className="space-y-2">
                          {(selectedBoat.availability || [])
                            .find((a) => a.date === selectedDate)
                            ?.slots?.map((slot) => (
                              <button
                                key={slot}
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full px-4 py-3 rounded-lg font-medium transition-all ${
                                  selectedSlot === slot
                                    ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                                    : "bg-white border-2 border-sky-200 text-slate-700 hover:border-blue-400"
                                }`}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  {slot}
                                </div>
                              </button>
                            ))}
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
                      onClick={() => alert("Hook this to Stripe booking later")}
                      className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold text-lg disabled:opacity-50"
                      disabled={!selectedDate || !selectedSlot}
                    >
                      {currentUser ? `Book Now - $${selectedBoat.price}` : "Sign In to Book"}
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
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {view === "messages" && currentUser && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Messages</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                    conversations.map((conv) => {
                      const otherId = (conv.participantIds || []).find((id) => id !== currentUser.uid);
                      const otherName = conv.participantNames?.[otherId] || "User";

                      return (
                        <button
                          key={conv.id}
                          onClick={() => setSelectedConversation(conv)}
                          className={`w-full text-left p-4 hover:bg-blue-50 transition-all ${
                            selectedConversation?.id === conv.id ? "bg-blue-50 border-l-4 border-blue-600" : ""
                          }`}
                        >
                          <div className="font-semibold text-slate-900 mb-1">{conv.boatName}</div>
                          <div className="text-sm text-slate-600">with {otherName}</div>
                          {conv.lastMessage ? (
                            <div className="text-xs text-slate-500 mt-1 truncate">{conv.lastMessage}</div>
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="md:col-span-2 bg-white rounded-2xl shadow-lg border border-sky-100 overflow-hidden">
                {selectedConversation ? (
                  <div className="flex flex-col h-[600px]">
                    <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
                      <h3 className="font-bold text-lg">{selectedConversation.boatName}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-12">
                          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.senderId === currentUser.uid ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] md:max-w-[60%] ${
                                msg.senderId === currentUser.uid
                                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                                  : "bg-slate-100 text-slate-900"
                              } rounded-2xl px-4 py-3`}
                            >
                              <div className="font-medium text-sm mb-1 opacity-90">{msg.senderName}</div>
                              <div>{msg.text}</div>
                              <div className={`text-xs mt-1 ${msg.senderId === currentUser.uid ? "text-white/70" : "text-slate-500"}`}>
                                {msg.timestamp ? msg.timestamp.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : ""}
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
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
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
                      <p className="text-slate-500">Choose a conversation from the left</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* List Boat */}
        {view === "list-boat" && currentUser && currentUserType === "owner" && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">List Your Boat</h2>

            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-sky-100 space-y-4">
              <input
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                placeholder="Boat Name"
                value={newBoat.name}
                onChange={(e) => setNewBoat({ ...newBoat, name: e.target.value })}
              />

              <select
                className="w-full px-4 py-3 border border-sky-200 rounded-lg bg-white"
                value={newBoat.location}
                onChange={(e) => setNewBoat({ ...newBoat, location: e.target.value })}
              >
                <option value="Port Credit">Port Credit</option>
                <option value="Toronto Harbour">Toronto Harbour</option>
                <option value="Hamilton Harbour">Hamilton Harbour</option>
              </select>

              <textarea
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                rows={4}
                placeholder="Description"
                value={newBoat.description}
                onChange={(e) => setNewBoat({ ...newBoat, description: e.target.value })}
              />

              <input
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                placeholder="Amenities (comma-separated)"
                value={newBoat.amenities}
                onChange={(e) => setNewBoat({ ...newBoat, amenities: e.target.value })}
              />

              <div className="flex gap-3">
                <button
                  onClick={addNewBoat}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold"
                >
                  List Boat
                </button>

                <button
                  onClick={() => setView("browse")}
                  className="px-6 py-4 border-2 border-slate-300 text-slate-700 rounded-xl font-bold hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* If owner tries list-boat without owner mode */}
        {view === "list-boat" && currentUser && currentUserType !== "owner" && (
          <div className="bg-white rounded-2xl p-10 shadow border border-sky-100 text-center">
            <h3 className="text-xl font-bold text-slate-900 mb-2">Switch to Owner mode</h3>
            <p className="text-slate-600">Use the account type switcher in the header.</p>
          </div>
        )}
      </main>
    </div>
  );
}
