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
  deleteDoc,
  getDocs,
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

const HOURS = [
  { value: 0, label: "12:00 AM" },
  { value: 1, label: "1:00 AM" },
  { value: 2, label: "2:00 AM" },
  { value: 3, label: "3:00 AM" },
  { value: 4, label: "4:00 AM" },
  { value: 5, label: "5:00 AM" },
  { value: 6, label: "6:00 AM" },
  { value: 7, label: "7:00 AM" },
  { value: 8, label: "8:00 AM" },
  { value: 9, label: "9:00 AM" },
  { value: 10, label: "10:00 AM" },
  { value: 11, label: "11:00 AM" },
  { value: 12, label: "12:00 PM" },
  { value: 13, label: "1:00 PM" },
  { value: 14, label: "2:00 PM" },
  { value: 15, label: "3:00 PM" },
  { value: 16, label: "4:00 PM" },
  { value: 17, label: "5:00 PM" },
  { value: 18, label: "6:00 PM" },
  { value: 19, label: "7:00 PM" },
  { value: 20, label: "8:00 PM" },
  { value: 21, label: "9:00 PM" },
  { value: 22, label: "10:00 PM" },
  { value: 23, label: "11:00 PM" },
];


function pad2(n) {
  return String(n).padStart(2, "0");
}

// Use local date (prevents timezone shifting)
function toLocalDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function minutes(h, m) {
  return h * 60 + m;
}

function minutesToHHMM(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${pad2(h)}:${pad2(m)}`;
}



function formatPrice(value) {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
      maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
    }).format(safe);
  } catch {
    // Fallback if Intl is blocked or unavailable
    return `$${safe.toFixed(2)}`;
  }
}
// Builds slots like "09:00-13:00"
function buildSlotsFromRules(rules) {
  const startHour = Number(rules?.startHour ?? 9);
  const endHour = Number(rules?.endHour ?? 22);
  const slotLength = Number(rules?.slotLength ?? 4); // hours

  const duration = slotLength * 60;

  const startMin = minutes(startHour, 0);
  const endMin = minutes(endHour, 0);

  const slots = [];
  for (let s = startMin; s + duration <= endMin; s += duration) {
    const e = s + duration;
    slots.push(`${minutesToHHMM(s)}-${minutesToHHMM(e)}`);
  }

  return slots;
}

/* ----------------- Cloudinary Upload (Unsigned) -----------------
   IMPORTANT:
   - Do NOT use api_key / api_secret in the browser.
   - Create an UNSIGNED upload preset in Cloudinary.
   - Put these in .env.local or Netlify env:
     NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
     NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...
------------------------------------------------------------------- */
async function uploadImagesToCloudinary(files) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Missing Cloudinary env vars (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET).");
  }

  const uploads = Array.from(files || []).map(async (file) => {
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", uploadPreset);
    form.append("folder", "boats");

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body: form,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cloudinary upload failed: ${text}`);
    }

    const data = await res.json();
    return data.secure_url;
  });

  return Promise.all(uploads);
}

/* --------------------------- DatePicker --------------------------- */
function DatePicker({ selectedDate, onSelectDate, rules }) {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

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

  const isDateSelected = (date) => {
    if (!date || !selectedDate) return false;
    return toLocalDateStr(date) === selectedDate;
  };

  const isDateAvailable = (date) => {
    if (!date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (date < today) return false;

    const slots = buildSlotsFromRules(rules || {});
    return slots.length > 0;
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
              onClick={() => date && available && !isPast && onSelectDate(toLocalDateStr(date))}
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
  const [view, setView] = useState("landing");

  const [boats, setBoats] = useState([]);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [locationFilter, setLocationFilter] = useState("All Locations");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState([]);

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

  // bookings
  const [myBookings, setMyBookings] = useState([]);

  // rating
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingText, setRatingText] = useState("");
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [hasConfirmedBookingForBoat, setHasConfirmedBookingForBoat] = useState(false);

  // owner list boat
  const [newBoat, setNewBoat] = useState({
    name: "",
    location: "Port Credit",
    type: "Sailboat",
    capacity: 4,
    price: 200,
    description: "",
    amenities: "",
    imageUrl: "", // optional cover url

    // ✅ availability rules
    startHour: 9,
    endHour: 22,
    slotLength: 4,
    minHours: 4,
  });

  const [newBoatImages, setNewBoatImages] = useState([]); // array of File
  const [editingBoat, setEditingBoat] = useState(null);
  const [editImageFiles, setEditImageFiles] = useState([]); // array of File

  const [uploading, setUploading] = useState(false);
  const [siteInfoTarget, setSiteInfoTarget] = useState("");

  const openSiteSection = (sectionId) => {
    setSiteInfoTarget(sectionId);
    setView("site-info");
  };

  useEffect(() => {
    if (view !== "site-info" || !siteInfoTarget) return;
    const t = setTimeout(() => {
      const el = document.getElementById(siteInfoTarget);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
    return () => clearTimeout(t);
  }, [view, siteInfoTarget]);


  /* -------- Header: subtle scrolled state -------- */
  useEffect(() => {
    const headerScrollHandler = () => {
      const header = document.querySelector(".header-glass");
      if (!header) return;
      if (window.scrollY > 8) header.classList.add("scrolled");
      else header.classList.remove("scrolled");
    };
    headerScrollHandler();
    window.addEventListener("scroll", headerScrollHandler, { passive: true });
    return () => window.removeEventListener("scroll", headerScrollHandler);
  }, []);

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
    if (!selectedConversation?.id) return;

    const q = query(
      collection(db, "conversations", selectedConversation.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
          createdAt: d.data().createdAt?.toDate?.() || null,
        }))
      );
    });

    return () => unsubscribe();
  }, [selectedConversation?.id]);

  /* -------- Booked Slots for Date -------- */
  useEffect(() => {
    if (!selectedBoat?.id || !selectedDate) {
      setBookedSlotsForDate([]);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("boatId", "==", selectedBoat.id),
      where("date", "==", selectedDate),
      where("status", "==", "confirmed")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const booked = snap.docs.map((d) => d.data().slot).filter(Boolean);
        setBookedSlotsForDate(booked);

        // if the selected slot was just booked, unselect it
        if (selectedSlot && booked.includes(selectedSlot)) {
          setSelectedSlot("");
        }
      },
      (err) => console.error("bookings snapshot error:", err)
    );

    return () => unsub();
  }, [selectedBoat?.id, selectedDate, selectedSlot]);

  /* -------- My Bookings -------- */
 useEffect(() => {
  if (!currentUser) {
    setMyBookings([]);
    return;
  }

  const q = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));

  const unsub = onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // sort client-side to avoid index requirement
      list.sort((a, b) => {
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
      });
      setMyBookings(list);
    },
    (err) => console.error("my bookings error:", err)
  );

  return () => unsub();
}, [currentUser?.uid]);


  /* -------- Rating gating (must have confirmed booking for this boat) -------- */
  useEffect(() => {
    if (!currentUser?.uid || !selectedBoat?.id) {
      setHasConfirmedBookingForBoat(false);
      return;
    }

    const q = query(
      collection(db, "bookings"),
      where("boatId", "==", selectedBoat.id),
      where("userId", "==", currentUser.uid),
      where("status", "==", "confirmed")
    );

    const unsub = onSnapshot(q, (snap) => {
      setHasConfirmedBookingForBoat(!snap.empty);
    });

    return () => unsub();
  }, [currentUser?.uid, selectedBoat?.id]);

  /* -------- Already reviewed check -------- */
  useEffect(() => {
    if (!currentUser?.uid || !selectedBoat?.id) {
      setAlreadyReviewed(false);
      return;
    }

    const q = query(
      collection(db, "reviews"),
      where("boatId", "==", selectedBoat.id),
      where("userId", "==", currentUser.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAlreadyReviewed(!snap.empty);
    });

    return () => unsub();
  }, [currentUser?.uid, selectedBoat?.id]);

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

    if (boat.ownerId === currentUser.uid) {
      return alert("You can’t message your own listing. Use a second account/incognito to test chat.");
    }

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
        lastMessageAt: serverTimestamp(),
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

    const text = messageInput.trim();
    setMessageInput("");

    try {
      await addDoc(collection(db, "conversations", selectedConversation.id, "messages"), {
        senderId: currentUser.uid,
        senderName: currentUser.displayName || "User",
        text,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, "conversations", selectedConversation.id), {
        lastMessage: text,
        lastMessageAt: serverTimestamp(),
      });
    } catch (err) {
      console.error("Send message failed:", err);
      alert("Message failed to send");
      setMessageInput(text);
    }
  };

  /* ---------------- Rating ---------------- */
  const submitRating = async () => {
    if (!currentUser) return setShowAuthModal(true);
    if (!selectedBoat?.id) return;

    if (selectedBoat.ownerId === currentUser.uid) return alert("You can’t rate your own boat.");
    if (!hasConfirmedBookingForBoat) return alert("You can only rate after a confirmed booking.");
    if (alreadyReviewed) return alert("You already rated this boat.");

    const stars = Number(ratingValue);
    if (Number.isNaN(stars) || stars < 1 || stars > 5) return alert("Pick 1 to 5 stars.");

    try {
      await addDoc(collection(db, "reviews"), {
        boatId: selectedBoat.id,
        boatName: selectedBoat.name || "",
        ownerId: selectedBoat.ownerId || "",
        userId: currentUser.uid,
        userName: currentUser.displayName || "User",
        stars,
        text: ratingText.trim(),
        createdAt: serverTimestamp(),
      });

      // recompute rating from all reviews for this boat
      const allQ = query(collection(db, "reviews"), where("boatId", "==", selectedBoat.id));
      const snap = await getDocs(allQ);

      let sum = 0;
      let count = 0;
      snap.forEach((d) => {
        const s = Number(d.data().stars || 0);
        if (s >= 1 && s <= 5) {
          sum += s;
          count += 1;
        }
      });

      const avg = count ? Math.round((sum / count) * 10) / 10 : 0;

      await updateDoc(doc(db, "boats", selectedBoat.id), {
        rating: avg,
        reviews: count,
        updatedAt: serverTimestamp(),
      });

      setRatingText("");
      setRatingValue(5);
      alert("Thanks! Rating submitted.");
    } catch (e) {
      console.error(e);
      alert(e.message || "Rating failed");
    }
  };

  /* ---------------- Owner: Add Boat ---------------- */
  const addNewBoat = async () => {
    if (!currentUser) return setShowAuthModal(true);
    if (currentUserType !== "owner") return alert("Switch to Owner mode to list boats.");
    if (!newBoat.name || !newBoat.description) return alert("Fill boat name + description");

    setUploading(true);

    try {
      const amenitiesArr = (newBoat.amenities || "")
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      const defaultUrl = "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80";

      // Upload selected files to Cloudinary (optional)
      const uploadedUrls = await uploadImagesToCloudinary(newBoatImages);

      // Gallery images = uploaded files + (optional) cover url (if owner pasted a url)
      const imageUrls = [
        ...uploadedUrls,
        ...(newBoat.imageUrl?.trim() ? [newBoat.imageUrl.trim()] : []),
      ];

      const cover = uploadedUrls[0] || newBoat.imageUrl?.trim() || defaultUrl;

      await addDoc(collection(db, "boats"), {
        name: newBoat.name,
        location: newBoat.location,
        type: newBoat.type,
        capacity: Number(newBoat.capacity),
        price: Number(newBoat.price),
        description: newBoat.description,
        amenities: amenitiesArr,

        imageUrls,
        imageUrl: cover,

        ownerId: currentUser.uid,
        ownerName: currentUser.displayName || "Owner",
        ownerEmail: currentUser.email || "",

        rating: 0,
        reviews: 0,

        availabilityRules: {
          minHours: Number(newBoat.minHours),
          slotLength: Number(newBoat.slotLength),
          startHour: Number(newBoat.startHour),
          endHour: Number(newBoat.endHour),
        },

        createdAt: serverTimestamp(),
      });

      setNewBoatImages([]);
      setNewBoat({
        name: "",
        location: "Port Credit",
        type: "Sailboat",
        capacity: 4,
        price: 200,
        description: "",
        amenities: "",
        imageUrl: "",
        startHour: 9,
        endHour: 22,
        slotLength: 4,
        minHours: 4,
      });

      alert("Boat listed!");
      setView("browse");
    } catch (e) {
      console.error("addNewBoat error:", e);
      alert(e.message || "Boat listing failed");
    } finally {
      setUploading(false);
    }
  };

  /* ---------------- Owner: Edit Boat ---------------- */
  const saveBoatEdits = async () => {
    if (!currentUser || currentUserType !== "owner" || !editingBoat) return;

    setUploading(true);

    try {
      if (editingBoat.ownerId !== currentUser.uid) return alert("Not your boat.");

      const newImageUrls = await uploadImagesToCloudinary(editImageFiles);

      const existingUrls = Array.isArray(editingBoat.imageUrls) ? editingBoat.imageUrls : [];
      const mergedUrls = newImageUrls.length ? [...existingUrls, ...newImageUrls] : existingUrls;

      const cover = (editingBoat.imageUrl || "").trim() || mergedUrls[0] || "";

      await updateDoc(doc(db, "boats", editingBoat.id), {
        name: editingBoat.name,
        location: editingBoat.location,
        description: editingBoat.description,
        amenities: Array.isArray(editingBoat.amenities) ? editingBoat.amenities : [],
        imageUrls: mergedUrls,
        imageUrl: cover,
        updatedAt: serverTimestamp(),
      });

      alert("Saved!");
      const updatedBoat = { ...editingBoat, imageUrls: mergedUrls, imageUrl: cover };
      setSelectedBoat(updatedBoat);
      setEditingBoat(updatedBoat);
      setEditImageFiles([]);
      setView("boat-detail");
    } catch (e) {
      console.error(e);
      alert(e.message || "Save failed");
    } finally {
      setUploading(false);
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
    <div className="app-shell">
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onGoogle={handleGoogleSignIn}
          onEmailAuth={handleEmailAuth}
        />
      )}

      {/* Header */}
      <header className="header-glass animate-slideDown">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView("landing")}>
              <div className="gradient-blue rounded-2xl shadow-blue p-2.5 hover-scale">
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
                    className="px-4 py-2.5 btn-secondary text-sm"
                  >
                    Messages
                  </button>

                  <button
                    onClick={() => setView("bookings")}
                    className="px-4 py-2.5 btn-secondary text-sm"
                  >
                    My Bookings
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
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 active:scale-95"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="px-5 py-2.5 btn-primary text-sm flex items-center gap-2"
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
        
        {/* Landing */}
        {view === "landing" && (
          <div className="space-y-10">
            {/* Hero */}
            <section className="relative overflow-hidden rounded-3xl border border-white/60 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(37,99,235,0.18),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.85),rgba(255,255,255,0.55))] shadow-strong">
              <div className="absolute inset-0 pointer-events-none bg-grid-soft" />
              <div className="relative px-6 py-14 md:px-12 md:py-20">
                <div className="max-w-3xl">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow" />
                    Trusted local charter marketplace
                  </p>

                  <h2 className="mt-4 text-4xl md:text-6xl font-extrabold tracking-tight text-slate-950">
                    Discover Toronto&apos;s{" "}
                    <span className="bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500 bg-clip-text text-transparent">
                      Beautiful Waters
                    </span>
                  </h2>

                  <p className="mt-4 text-base md:text-lg text-slate-600 leading-relaxed">
                    Rent premium boats from verified local owners. Book in minutes, message owners instantly, and
                    explore Lake Ontario like you belong on it.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {LOCATIONS.filter((l) => l !== "All Locations").map((loc) => (
                      <button
                        key={loc}
                        onClick={() => {
                          setLocationFilter(loc);
                          setView("browse");
                        }}
                        className="chip chip-soft"
                      >
                        <MapPin className="w-4 h-4" />
                        {loc.replace("Harbour", "")}
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setView("browse")}
                      className="btn btn-primary btn-lg"
                    >
                      Browse Charters
                      <span className="ml-2">→</span>
                    </button>

                    {currentUserType === "owner" ? (
                      <button onClick={() => setView("list-boat")} className="btn btn-ghost btn-lg">
                        List Your Boat
                      </button>
                    ) : (
                      <button
                        onClick={() => (currentUser ? switchAccountType("owner") : setShowAuthModal(true))}
                        className="btn btn-ghost btn-lg"
                      >
                        Become an Owner
                      </button>
                    )}
                  </div>

                  <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { k: "Instant booking", v: "Secure checkout" },
                      { k: "Live chat", v: "Message owners" },
                      { k: "Transparent pricing", v: "No surprises" },
                      { k: "Verified owners", v: "Trusted marketplace" },
                    ].map((x) => (
                      <div key={x.k} className="rounded-2xl bg-white/70 border border-white/60 p-4 shadow-soft">
                        <div className="text-sm font-semibold text-slate-900">{x.k}</div>
                        <div className="text-xs text-slate-600 mt-1">{x.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Featured */}
            <section className="space-y-4">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-950">Featured Charters</h3>
                  <p className="text-slate-600 mt-1">Hand-picked listings to get you on the water fast.</p>
                </div>
                <button onClick={() => setView("browse")} className="btn btn-ghost">
                  View all
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {filteredBoats.length === 0 ? (
                <div className="card p-10 text-center">
                  <Anchor className="w-14 h-14 text-slate-300 mx-auto mb-4" />
                  <div className="text-lg font-bold text-slate-900">No boats yet</div>
                  <div className="text-slate-600 mt-1">Switch to Owner mode and list one to test the full flow.</div>
                  <div className="mt-5">
                    <button
                      onClick={() => (currentUser ? switchAccountType("owner") : setShowAuthModal(true))}
                      className="btn btn-primary"
                    >
                      List a boat
                    </button>
                  </div>
                </div>
              ) : (
                <div className="lux-msg-grid">
                  {filteredBoats.slice(0, 3).map((boat) => (
                    <div
                      key={boat.id}
                      onClick={() => {
                        setSelectedBoat(boat);
                        setSelectedDate("");
                        setSelectedSlot("");
                        setView("boat-detail");
                      }}
                      className="card overflow-hidden group cursor-pointer"
                    >
                      <div className="relative h-52 overflow-hidden">
                        <img
                          src={
                            boat.imageUrl ||
                            "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=80"
                          }
                          alt={boat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                        <div className="absolute top-4 left-4 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow-soft">
                          <MapPin className="w-4 h-4" />
                          {boat.location}
                        </div>
                        <div className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900 shadow-soft">
                          {formatPrice(boat.price)}<span className="text-slate-600 font-semibold">/4hrs</span>
                        </div>
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="text-white text-xl font-extrabold">{boat.name}</div>
                          <div className="mt-2 flex items-center justify-between text-white/90 text-sm">
                            <span className="inline-flex items-center gap-1">
                              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                              {boat.rating || 0}
                              <span className="text-white/70">({boat.reviews || 0})</span>
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-4 h-4" /> Up to {boat.capacity}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="flex items-center justify-between">
                          <div className="text-sm text-slate-600">{boat.type}</div>
                          <button className="btn btn-primary btn-sm">View</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* How it works */}
            <section className="lux-msg-grid">
              {[
                {
                  title: "Browse & pick a boat",
                  desc: "Filter by harbour, compare options, and open a listing for details.",
                  icon: <Anchor className="w-5 h-5" />,
                },
                {
                  title: "Choose date & time",
                  desc: "Select an available slot. Once paid, we lock that time automatically.",
                  icon: <Calendar className="w-5 h-5" />,
                },
                {
                  title: "Confirm & message owner",
                  desc: "Instant confirmation, and chat is built-in for quick coordination.",
                  icon: <MessageCircle className="w-5 h-5" />,
                },
              ].map((s, i) => (
                <div key={i} className="card p-6">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-soft">
                    {s.icon}
                  </div>
                  <div className="mt-4 text-lg font-extrabold text-slate-950">{s.title}</div>
                  <div className="mt-1 text-slate-600">{s.desc}</div>
                </div>
              ))}
            </section>
          </div>
        )}

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
                  className={`chip ${locationFilter === loc ? "chip--active" : ""}`}
                >
                  {loc}
                </button>
              ))}
            </div>

            {filteredBoats.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center shadow-strong border-2 border-slate-200 animate-fadeIn">
                <Anchor className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-700 mb-2">No boats available yet</h3>
                <p className="text-slate-500 mb-6">List one as an Owner to test availability + chat.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 stagger-animation">
                {filteredBoats.map((boat) => (
                  <div
                    key={boat.id}
                    onClick={() => {
                      setSelectedBoat(boat);
                      setSelectedDate("");
                      setSelectedSlot("");
                      setView("boat-detail");
                    }}
                    className="card-premium cursor-pointer group stagger-animation"
                  >
                    <div className="relative h-56 overflow-hidden image-overlay">
                      <img
                        src={
                          boat.imageUrl ||
                          "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"
                        }
                        alt={boat.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      />
                      <div className="absolute top-4 right-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900 shadow-soft border border-white/60">
                        {formatPrice(boat.price)}<span className="text-slate-600 font-semibold">/4hrs</span>
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
                      <div className="pt-4 border-t-2 border-slate-100">
                        <button className="w-full btn-primary">
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

            {currentUser && currentUserType === "owner" && selectedBoat.ownerId === currentUser.uid && (
              <div className="mb-4 flex gap-2">
                <button
                  onClick={() => {
                    setEditingBoat(selectedBoat);
                    setEditImageFiles([]);
                    setView("edit-boat");
                  }}
                  className="px-4 py-2.5 btn-secondary text-sm"
                >
                  Edit Listing
                </button>

                <button
                  onClick={async () => {
                    if (!confirm("Delete this boat listing?")) return;
                    await deleteDoc(doc(db, "boats", selectedBoat.id));
                    alert("Deleted.");
                    setSelectedBoat(null);
                    setView("browse");
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            )}

            <div className="bg-white rounded-3xl overflow-hidden shadow-strong border-2 border-slate-200 animate-fadeIn">
              <img
                src={
                  selectedBoat.imageUrl ||
                  "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80"
                }
                alt={selectedBoat.name}
                className="w-full h-64 md:h-96 object-cover"
              />

              {/* gallery */}
              {Array.isArray(selectedBoat.imageUrls) && selectedBoat.imageUrls.length > 1 && (
                <div className="p-4 bg-white border-b border-sky-100">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {selectedBoat.imageUrls.slice(0, 8).map((u, idx) => (
                      <img key={idx} src={u} alt="boat" className="w-full h-24 object-cover rounded-lg border" />
                    ))}
                  </div>
                </div>
              )}

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

                  <div className="gradient-blue text-white px-6 py-5 rounded-2xl shadow-blue">
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
                          className="badge badge-blue"
                        >
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Rating */}
                <div className="border-t border-sky-100 pt-6 mb-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-3">Rate this Boat</h3>

                  {!currentUser ? (
                    <button
                      onClick={() => setShowAuthModal(true)}
                      className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg font-medium"
                    >
                      Sign in to rate
                    </button>
                  ) : selectedBoat.ownerId === currentUser.uid ? (
                    <div className="text-slate-500 text-sm">Owners can’t rate their own listing.</div>
                  ) : !hasConfirmedBookingForBoat ? (
                    <div className="text-slate-500 text-sm">You can rate after you have a confirmed booking.</div>
                  ) : alreadyReviewed ? (
                    <div className="text-slate-500 text-sm">You already rated this boat.</div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-slate-700">Stars</label>
                        <select
                          value={ratingValue}
                          onChange={(e) => setRatingValue(Number(e.target.value))}
                          className="px-3 py-2 border border-sky-200 rounded-lg bg-white"
                        >
                          <option value={5}>⭐⭐⭐⭐⭐ (5)</option>
                          <option value={4}>⭐⭐⭐⭐ (4)</option>
                          <option value={3}>⭐⭐⭐ (3)</option>
                          <option value={2}>⭐⭐ (2)</option>
                          <option value={1}>⭐ (1)</option>
                        </select>
                      </div>

                      <textarea
                        rows={3}
                        value={ratingText}
                        onChange={(e) => setRatingText(e.target.value)}
                        placeholder="Optional comment..."
                        className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                      />

                      <button
                        onClick={submitRating}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-3 rounded-xl font-bold"
                      >
                        Submit Rating
                      </button>
                    </div>
                  )}
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
                        rules={selectedBoat.availabilityRules || {}}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-3">Select Time Slot</label>

                      {selectedDate ? (
                        <div className="space-y-2">
                          {buildSlotsFromRules(selectedBoat.availabilityRules || {})
                            .filter((slot) => !bookedSlotsForDate.includes(slot))
                            .map((slot) => (
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
                      onClick={async () => {
                        if (!currentUser) return setShowAuthModal(true);
                        if (!selectedBoat?.id || !selectedDate || !selectedSlot) return;

                        try {
                          const res = await fetch("/api/create-checkout-session", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              boatName: selectedBoat.name,
                              boatId: selectedBoat.id,
                              date: selectedDate,
                              slot: selectedSlot,
                              price: selectedBoat.price,
                              userId: currentUser.uid,
                              ownerEmail: selectedBoat.ownerEmail || "",
                              ownerId: selectedBoat.ownerId || "",
                            }),
                          });

                          const data = await res.json();
                          if (!res.ok) throw new Error(data?.error || "Checkout failed");

                          window.location.href = data.url;
                        } catch (e) {
                          alert(e.message || "Checkout failed");
                        }
                      }}
                      className="flex-1 btn-primary py-4 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
                      disabled={!selectedDate || !selectedSlot}
                    >
                      {currentUser ? `Book Now - $${selectedBoat.price}` : "Sign In to Book"}
                    </button>

                    <button
                      onClick={() => startConversation(selectedBoat)}
                      className="px-6 py-4 border-2 border-blue-600 text-blue-600 rounded-xl font-bold hover:bg-blue-50 hover:border-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95"
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-slate-900">Messages</h2>

              <button
                onClick={() => setView("browse")}
                className="px-4 py-2.5 btn-secondary text-sm"
              >
                ← Back to Browse
              </button>
            </div>

            <div className="lux-msg-grid">
              <div className="md:col-span-1 card-premium overflow-hidden lux-msg-list">
                <div className="gradient-blue text-white p-5">
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

              <div className="md:col-span-2 card-premium overflow-hidden lux-msg-chat">
                {selectedConversation ? (
                  <div className="flex flex-col h-[620px] md:h-[680px]">
                    <div className="gradient-blue text-white p-5">
                      <h3 className="font-bold text-lg">{selectedConversation.boatName}</h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {messages.length === 0 ? (
                        <div className="text-center py-12">
                          <MessageCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500">No messages yet. Start the conversation!</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = msg.senderId === currentUser.uid;

                          return (
                            <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[80%] md:max-w-[60%] flex items-end gap-2 ${
                                  isMine ? "flex-row-reverse" : ""
                                }`}
                              >
                                {!isMine && (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold">
                                    {msg.senderName?.[0]?.toUpperCase() || "U"}
                                  </div>
                                )}

                                <div
                                  className={`rounded-2xl px-4 py-3 shadow-sm ${
                                    isMine
                                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white"
                                      : "bg-white border border-slate-200 text-slate-900"
                                  }`}
                                >
                                  {!isMine && (
                                    <div className="text-xs font-semibold text-slate-500 mb-1">
                                      {msg.senderName || "User"}
                                    </div>
                                  )}

                                  <div className="whitespace-pre-wrap break-words">{msg.text}</div>

                                  <div className={`text-[11px] mt-1 ${isMine ? "text-white/70" : "text-slate-400"}`}>
                                    {msg.createdAt
                                      ? msg.createdAt.toLocaleTimeString("en-US", {
                                          hour: "numeric",
                                          minute: "2-digit",
                                        })
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
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
                          className="flex-1 px-4 py-3 rounded-xl border border-sky-200 bg-white/80 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Site Info */}
        {view === "site-info" && (
          <div className="lux-section">
            <div className="lux-hero lux-hero--compact">
              <div className="lux-hero__inner">
                <div>
                  <div className="lux-eyebrow">Support & Policies</div>
                  <h1 className="lux-title">Help Center & Legal</h1>
                  <p className="lux-subtitle">Everything you need in one place — help, terms, privacy, cookies, and contact.</p>
                </div>

                <div className="lux-hero__actions">
                  <button onClick={() => setView("browse")} className="btn-secondary">
                    ← Back to Browse
                  </button>
                </div>
              </div>
            </div>

            <div className="lux-info-grid">
              <aside className="lux-info-nav">
                <div className="lux-info-nav__title">On this page</div>
                <button onClick={() => openSiteSection('help-center')} className="lux-info-nav__item">Help Center</button>
                <button onClick={() => openSiteSection('terms')} className="lux-info-nav__item">Terms of Service</button>
                <button onClick={() => openSiteSection('privacy')} className="lux-info-nav__item">Privacy Policy</button>
                <button onClick={() => openSiteSection('cookies')} className="lux-info-nav__item">Cookie Policy</button>
                <button onClick={() => openSiteSection('contact')} className="lux-info-nav__item">Contact Us</button>
              </aside>

              <div className="lux-info-content">
                <section id="help-center" className="lux-info-card">
                  <h2>Help Center</h2>
                  <p>
                    Need help with bookings, payments, or messaging? Start here.
                    If something looks off (availability, confirmations, reviews), refresh once and check <strong>My Bookings</strong>.
                  </p>
                  <ul>
                    <li><strong>Booking confirmations:</strong> after payment, your booking should appear in <strong>My Bookings</strong>.</li>
                    <li><strong>Availability:</strong> booked dates should no longer show as available for that time slot.</li>
                    <li><strong>Messaging:</strong> open <strong>Messages</strong> to chat with the boat owner before you book.</li>
                    <li><strong>Reviews:</strong> once submitted, your review is stored and can be displayed on the boat’s listing page (we’ll wire that next).</li>
                  </ul>
                </section>

                <section id="terms" className="lux-info-card">
                  <h2>Terms of Service</h2>
                  <p>
                    By using GTA Charter, you agree to provide accurate booking information, respect vessel rules,
                    and comply with local laws and marina regulations. Payments are handled securely through Stripe.
                  </p>
                  <p className="lux-muted">This is placeholder copy for now — you can replace it with your final legal text later.</p>
                </section>

                <section id="privacy" className="lux-info-card">
                  <h2>Privacy Policy</h2>
                  <p>
                    We only collect what’s needed to run bookings and messaging (account details, booking history, and basic usage events).
                    We don’t sell your personal data.
                  </p>
                  <p className="lux-muted">Placeholder copy — swap with your final privacy policy when ready.</p>
                </section>

                <section id="cookies" className="lux-info-card">
                  <h2>Cookie Policy</h2>
                  <p>
                    Cookies help keep you signed in and improve performance. You can block cookies in your browser settings,
                    but some features may not work properly.
                  </p>
                  <p className="lux-muted">Placeholder copy — swap with your final cookie policy when ready.</p>
                </section>

                <section id="contact" className="lux-info-card">
                  <h2>Contact Us</h2>
                  <div className="lux-contact">
                    <div>
                      <div className="lux-contact__label">Phone</div>
                      <div className="lux-contact__value">6475683636</div>
                    </div>
                    <div>
                      <div className="lux-contact__label">Hours</div>
                      <div className="lux-contact__value">Daily 9am – 9pm</div>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}


        {/* List Boat */}
        {view === "list-boat" && currentUser && currentUserType === "owner" && (
          <div>
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">List Your Boat</h2>
                <p className="text-slate-600 mt-1">Create a premium listing that looks great on mobile and desktop.</p>
              </div>
              <button onClick={() => setView("browse")} className="btn btn-ghost">
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>

            <div className="card p-7 md:p-10 animate-fadeIn">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="label">Boat name</label>
                  <input
                    className="input"
                    placeholder="e.g., Sea Ray 440 Flybridge"
                    value={newBoat.name}
                    onChange={(e) => setNewBoat({ ...newBoat, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="label">Harbour</label>
                  <select
                    className="select"
                    value={newBoat.location}
                    onChange={(e) => setNewBoat({ ...newBoat, location: e.target.value })}
                  >
                    <option value="Port Credit">Port Credit</option>
                    <option value="Toronto Harbour">Toronto Harbour</option>
                    <option value="Hamilton Harbour">Hamilton Harbour</option>
                  </select>
                </div>

                <div>
                  <label className="label">Boat type</label>
                  <select
                    className="select"
                    value={newBoat.type}
                    onChange={(e) => setNewBoat({ ...newBoat, type: e.target.value })}
                  >
                    <option value="Sailboat">Sailboat</option>
                    <option value="Motor Yacht">Motor Yacht</option>
                    <option value="Speedboat">Speedboat</option>
                    <option value="Pontoon">Pontoon</option>
                  </select>
                </div>

                <div>
                  <label className="label">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={newBoat.capacity}
                    onChange={(e) => setNewBoat({ ...newBoat, capacity: Number(e.target.value) })}
                  />
                  <p className="help">Max guests allowed on this charter.</p>
                </div>

                <div>
                  <label className="label">Price (per 4 hours)</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500 font-semibold">
                      $
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input pl-8"
                      value={newBoat.price}
                      onChange={(e) => setNewBoat({ ...newBoat, price: Number(e.target.value) })}
                      placeholder="e.g., 850"
                    />
                  </div>
                  <p className="help">Displayed on the browse card as “$X / 4hrs”.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="label">Description</label>
                  <textarea
                    className="textarea"
                    rows={5}
                    placeholder="What makes this charter special? Mention seating, sound system, amenities, and rules."
                    value={newBoat.description}
                    onChange={(e) => setNewBoat({ ...newBoat, description: e.target.value })}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="label">Amenities</label>
                  <input
                    className="input"
                    placeholder="e.g., Bluetooth sound system, cooler, bathroom, floaties"
                    value={newBoat.amenities}
                    onChange={(e) => setNewBoat({ ...newBoat, amenities: e.target.value })}
                  />
                  <p className="help">Separate with commas — these can be shown as chips later.</p>
                </div>

                <div className="md:col-span-2">
                  <label className="label">Cover image URL (optional)</label>
                  <input
                    className="input"
                    placeholder="Paste an image URL (used if you don’t upload photos)"
                    value={newBoat.imageUrl}
                    onChange={(e) => setNewBoat({ ...newBoat, imageUrl: e.target.value })}
                  />
                </div>
              </div>

              <div className="divider my-7" />

              <div className="grid lg:grid-cols-3 gap-5">
                <div className="lg:col-span-1">
                  <div className="text-sm font-extrabold text-slate-900">Availability window</div>
                  <div className="text-sm text-slate-600 mt-1">
                    Defines when the boat can be booked. Guests choose slots within this time range.
                  </div>
                </div>

                <div className="lg:col-span-2 grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label">Start time</label>
                    <select
                      className="select"
                      value={newBoat.startHour}
                      onChange={(e) => setNewBoat({ ...newBoat, startHour: Number(e.target.value) })}
                    >
                      {HOURS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">End time</label>
                    <select
                      className="select"
                      value={newBoat.endHour}
                      onChange={(e) => setNewBoat({ ...newBoat, endHour: Number(e.target.value) })}
                    >
                      {HOURS.map((h) => (
                        <option key={h.value} value={h.value}>
                          {h.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label">Slot length</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={newBoat.slotLength}
                      onChange={(e) => setNewBoat({ ...newBoat, slotLength: Number(e.target.value) })}
                    />
                    <p className="help">How long each selectable time slot is (hours).</p>
                  </div>

                  <div>
                    <label className="label">Minimum hours</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={newBoat.minHours}
                      onChange={(e) => setNewBoat({ ...newBoat, minHours: Number(e.target.value) })}
                    />
                    <p className="help">Minimum booking duration (hours).</p>
                  </div>
                </div>
              </div>

              <div className="divider my-7" />

              <div>
                <label className="label">Boat photos (gallery)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="file-input"
                  onChange={(e) => setNewBoatImages(Array.from(e.target.files || []))}
                />
                {newBoatImages.length > 0 && (
                  <div className="text-xs text-slate-500 mt-2">{newBoatImages.length} file(s) selected</div>
                )}
              </div>

              <div className="mt-7 flex flex-col sm:flex-row gap-3">
                <button onClick={addNewBoat} disabled={uploading} className="btn btn-primary flex-1">
                  {uploading ? "Uploading…" : "List Boat"}
                </button>

                <button onClick={() => setView("browse")} className="btn btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

{/* Edit Boat View */}
        {view === "edit-boat" && currentUser && currentUserType === "owner" && editingBoat && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-slate-900">Edit Listing</h2>
              <button
                onClick={() => setView("boat-detail")}
                className="px-4 py-2.5 btn-secondary text-sm"
              >
                ← Back
              </button>
            </div>

            <div className="bg-white rounded-3xl p-8 md:p-10 shadow-strong border-2 border-slate-200 space-y-5 animate-fadeIn">
              <input
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                value={editingBoat.name || ""}
                onChange={(e) => setEditingBoat({ ...editingBoat, name: e.target.value })}
                placeholder="Boat Name"
              />

              <select
                className="w-full px-4 py-3 border border-sky-200 rounded-lg bg-white"
                value={editingBoat.location || "Port Credit"}
                onChange={(e) => setEditingBoat({ ...editingBoat, location: e.target.value })}
              >
                <option value="Port Credit">Port Credit</option>
                <option value="Toronto Harbour">Toronto Harbour</option>
                <option value="Hamilton Harbour">Hamilton Harbour</option>
              </select>

              <textarea
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                rows={4}
                value={editingBoat.description || ""}
                onChange={(e) => setEditingBoat({ ...editingBoat, description: e.target.value })}
                placeholder="Description"
              />

              <input
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                value={(editingBoat.amenities || []).join(", ")}
                onChange={(e) =>
                  setEditingBoat({
                    ...editingBoat,
                    amenities: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
                  })
                }
                placeholder="Amenities (comma-separated)"
              />

              <input
                className="w-full px-4 py-3 border border-sky-200 rounded-lg"
                value={editingBoat.imageUrl || ""}
                onChange={(e) => setEditingBoat({ ...editingBoat, imageUrl: e.target.value })}
                placeholder="Cover Image URL (optional)"
              />

              {Array.isArray(editingBoat.imageUrls) && editingBoat.imageUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {editingBoat.imageUrls.slice(0, 8).map((u, idx) => (
                    <img key={idx} src={u} alt="boat" className="w-full h-24 object-cover rounded-lg border" />
                  ))}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Add Photos (optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full"
                  onChange={(e) => setEditImageFiles(Array.from(e.target.files || []))}
                />
                {editImageFiles.length > 0 && (
                  <div className="text-xs text-slate-500 mt-2">{editImageFiles.length} file(s) selected</div>
                )}
              </div>

              <button
                onClick={saveBoatEdits}
                disabled={uploading}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-4 rounded-xl font-bold disabled:opacity-60"
              >
                {uploading ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {/* My Bookings */}
        {view === "bookings" && currentUser && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold text-slate-900">My Bookings</h2>
              <button
                onClick={() => setView("browse")}
                className="px-4 py-2.5 btn-secondary text-sm"
              >
                ← Back to Browse
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-strong border-2 border-slate-200 overflow-hidden">
              {myBookings.length === 0 ? (
                <div className="p-10 text-center text-slate-500">No bookings yet.</div>
              ) : (
                <div className="divide-y-2 divide-slate-100">
                  {myBookings.map((b) => (
                    <div key={b.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">{b.boatName || "Boat"}</div>
                        <div className="text-sm text-slate-600">
                          {b.date} • {b.slot}
                        </div>
                        <div className="text-xs text-slate-500">Status: {b.status || "confirmed"}</div>
                      </div>

                      <div className="font-bold text-slate-900">
                        ${Number(b.price || 0).toFixed(2)} {String(b.currency || "cad").toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
      {/* Footer */}
      <footer className="mt-16 border-t border-white/60 bg-white/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-600 to-cyan-600 p-2 rounded-2xl shadow-soft">
                  <Anchor className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-950">GTA Charter</div>
                  <div className="text-xs text-slate-600">Lake Ontario Adventures</div>
                </div>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                A premium marketplace connecting passengers with trusted local charter owners across the GTA.
              </p>
              <div className="text-sm text-slate-700 font-semibold">Contact</div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Email:</span> support@gtacharter.ca
              </div>
              <div className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Phone:</span> 6475683636
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Explore</div>
              <button onClick={() => setView("browse")} className="footer-link">Browse Charters</button>
              <button onClick={() => setView("messages")} className="footer-link">Messages</button>
              <button onClick={() => setView("bookings")} className="footer-link">My Bookings</button>
              <button onClick={() => setView("landing")} className="footer-link">Home</button>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Support</div>
              <button type="button" onClick={() => openSiteSection("help-center")} className="footer-link">Help Center</button>
              <button type="button" onClick={() => openSiteSection("help-center")} className="footer-link">Safety</button>
              <button type="button" onClick={() => openSiteSection("help-center")} className="footer-link">Cancellation Policy</button>
              <button type="button" onClick={() => openSiteSection("help-center")} className="footer-link">Accessibility</button>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Legal</div>
              <button type="button" onClick={() => openSiteSection("terms")} className="footer-link">Terms</button>
              <button type="button" onClick={() => openSiteSection("privacy")} className="footer-link">Privacy</button>
              <button type="button" onClick={() => openSiteSection("cookies")} className="footer-link">Cookies</button>

              <div className="pt-4">
                <div className="text-xs text-slate-500">
                  © {new Date().getFullYear()} GTA Charter. All rights reserved.
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}