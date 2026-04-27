"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Anchor,
  Calendar,
  Clock,
  LogIn,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Plus,
  Star,
  Users,
  X,
} from "lucide-react";

import { auth, db } from "../lib/firebase";
import { authorizedJson } from "../lib/api";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  orderBy,
} from "firebase/firestore";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import BookingsPanel from "../components/BookingsPanel";
import BoatListingForm from "../components/BoatListingForm";
import BoatMediaGallery from "../components/BoatMediaGallery";
import ConfirmDialog from "../components/ConfirmDialog";
import DatePicker from "../components/DatePicker";
import MediaLightbox from "../components/MediaLightbox";
import MessagingWorkspace from "../components/MessagingWorkspace";
import OwnerPayoutCard from "../components/OwnerPayoutCard";
import StatusBanner from "../components/StatusBanner";
import {
  buildSlotsFromRules,
  getUnavailableSlotsForDate,
  isUpcomingBooking,
  normalizeDateInput,
  validateBookingSelection,
} from "../lib/marketplace/booking";
import { createBoatFormState, DEFAULT_BOAT_IMAGE, LOCATIONS } from "../lib/marketplace/constants";
import {
  formatConversationTime,
  formatDateLabel,
  formatPrice,
  formatSlotLabel,
  formatStatusLabel,
} from "../lib/marketplace/format";
import { uploadImagesToCloudinary, uploadMessageAttachmentToCloudinary } from "../lib/marketplace/images";
import {
  canBoatAcceptBookings,
  getBoatCoverImage,
  getBoatGalleryMedia,
  getListingStatus,
  isBoatVisibleToMarketplace,
  sanitizeMediaItems,
  normalizeBoatPayload,
  parseMediaUrlInput,
  sanitizeAmenityList,
  validateBoatForm,
} from "../lib/marketplace/listings";

function AuthModal({ onClose, onGoogle, onEmailAuth }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/60 bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Account access</div>
            <h3 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h3>
          </div>
          <button onClick={onClose} className="btn-ghost text-sm">
            Close
          </button>
        </div>

        <div className="mt-5 flex gap-2 rounded-2xl bg-slate-100 p-1">
          {[
            { value: "login", label: "Login" },
            { value: "signup", label: "Sign up" },
          ].map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setMode(item.value)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold ${
                mode === item.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole("user")}
            className={`rounded-2xl border px-4 py-3 text-left ${
              role === "user" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-bold text-slate-900">Passenger</div>
            <div className="mt-1 text-xs text-slate-500">Browse, chat, and book charters.</div>
          </button>
          <button
            type="button"
            onClick={() => setRole("owner")}
            className={`rounded-2xl border px-4 py-3 text-left ${
              role === "owner" ? "border-blue-300 bg-blue-50" : "border-slate-200 bg-white"
            }`}
          >
            <div className="font-bold text-slate-900">Owner</div>
            <div className="mt-1 text-xs text-slate-500">List boats and receive payouts.</div>
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <input className="input" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="mt-5 space-y-3">
          <button
            onClick={() => onEmailAuth({ mode, role, email, password })}
            className="btn btn-primary w-full"
          >
            {mode === "login" ? "Continue with email" : "Create account"}
          </button>

          <button onClick={() => onGoogle(role)} className="btn btn-secondary w-full">
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}

function boatToFormState(boat) {
  const rules = boat?.availabilityRules || {};
  const galleryUrls = getBoatGalleryMedia(boat)
    .filter((item) => item.url && item.url !== DEFAULT_BOAT_IMAGE && item.url !== boat?.imageUrl)
    .map((item) => item.url);

  return createBoatFormState({
    ...boat,
    amenities: Array.isArray(boat?.amenities) ? boat.amenities.join(", ") : boat?.amenities || "",
    mediaUrls: galleryUrls.join("\n"),
    status: boat?.status || "live",
    startHour: Number(rules.startHour ?? boat?.startHour ?? 9),
    endHour: Number(rules.endHour ?? boat?.endHour ?? 21),
    slotLength: Number(rules.slotLength ?? boat?.slotLength ?? 4),
    minHours: Number(rules.minHours ?? boat?.minHours ?? rules.slotLength ?? 4),
  });
}

function createConversationId(currentUserId, ownerId, boatId) {
  return [currentUserId, ownerId].sort().join("__") + `__${boatId}`;
}

export default function MarketplaceApp() {
  const [view, setView] = useState("landing");
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentUserType, setCurrentUserType] = useState(null);
  const [stripeConnect, setStripeConnect] = useState(null);
  const [stripeLoading, setStripeLoading] = useState(false);

  const [boats, setBoats] = useState([]);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const [isMediaViewerOpen, setIsMediaViewerOpen] = useState(false);
  const [locationFilter, setLocationFilter] = useState("All Locations");

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [bookedSlotsForDate, setBookedSlotsForDate] = useState([]);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [messageAttachment, setMessageAttachment] = useState(null);
  const [messageAttachmentPreview, setMessageAttachmentPreview] = useState(null);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState("");

  const [myBookings, setMyBookings] = useState([]);
  const [selectedBoatReviews, setSelectedBoatReviews] = useState([]);
  const [userReviews, setUserReviews] = useState([]);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingText, setRatingText] = useState("");

  const [newBoat, setNewBoat] = useState(createBoatFormState());
  const [newBoatImages, setNewBoatImages] = useState([]);
  const [editingBoat, setEditingBoat] = useState(null);
  const [editImageFiles, setEditImageFiles] = useState([]);
  const [listingErrors, setListingErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  const [feedback, setFeedback] = useState(null);
  const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const filteredBoats = useMemo(() => {
    const visibleBoats = boats.filter((boat) => isBoatVisibleToMarketplace(boat));
    if (locationFilter === "All Locations") return visibleBoats;
    return visibleBoats.filter((boat) => boat.location === locationFilter);
  }, [boats, locationFilter]);

  const ownerListings = useMemo(() => {
    if (!currentUser?.uid) return [];
    return boats
      .filter((boat) => boat.ownerId === currentUser.uid)
      .sort((left, right) => {
        const leftTime = left.updatedAt?.toMillis?.() || left.createdAt?.toMillis?.() || 0;
        const rightTime = right.updatedAt?.toMillis?.() || right.createdAt?.toMillis?.() || 0;
        return rightTime - leftTime;
      });
  }, [boats, currentUser?.uid]);

  const confirmedBookingsForSelectedBoat = useMemo(() => {
    if (!selectedBoat?.id) return [];
    return myBookings.filter((booking) => booking.boatId === selectedBoat.id && booking.status === "confirmed");
  }, [myBookings, selectedBoat?.id]);

  const hasConfirmedBookingForBoat = confirmedBookingsForSelectedBoat.length > 0;

  const alreadyReviewed = useMemo(() => {
    if (!selectedBoat?.id || !confirmedBookingsForSelectedBoat.length) return false;

    return confirmedBookingsForSelectedBoat.every((booking) =>
      userReviews.some((review) => (review.bookingId ? review.bookingId === booking.id : review.boatId === selectedBoat.id))
    );
  }, [confirmedBookingsForSelectedBoat, selectedBoat?.id, userReviews]);

  const activeListingForm = editingBoat || newBoat;
  const activeListingFiles = editingBoat ? editImageFiles : newBoatImages;

  useEffect(() => {
    setActiveGalleryIndex(0);
    setIsMediaViewerOpen(false);
  }, [selectedBoat?.id]);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [view, currentUser?.uid, currentUserType]);

  useEffect(() => {
    if (!isMobileMenuOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileMenuOpen]);

  useEffect(() => {
    if (!messageAttachment) {
      setMessageAttachmentPreview(null);
      return;
    }

    const previewUrl = URL.createObjectURL(messageAttachment);
    setMessageAttachmentPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [messageAttachment]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user || null);

      if (!user) {
        setUserProfile(null);
        setCurrentUserType(null);
        setStripeConnect(null);
        setLoading(false);
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        const profile = snapshot.data();
        setUserProfile(profile);
        setCurrentUserType(profile.lastActiveType || profile.accountTypes?.[0] || "user");
        setStripeConnect(profile.stripeConnect || null);
      } else {
        const fallbackType = "user";
        const profile = {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || (user.email ? user.email.split("@")[0] : "User"),
          photoURL: user.photoURL || "",
          accountTypes: [fallbackType],
          lastActiveType: fallbackType,
          createdAt: serverTimestamp(),
        };
        await setDoc(userRef, profile, { merge: true });
        setUserProfile(profile);
        setCurrentUserType(fallbackType);
        setStripeConnect(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const liveBoatsQuery = query(collection(db, "boats"), where("status", "==", "live"));
    const listingMap = new Map();
    let ownerUnsubscribe = null;

    const publishListings = () => {
      setBoats(Array.from(listingMap.values()));
    };

    const liveUnsubscribe = onSnapshot(
      liveBoatsQuery,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            listingMap.delete(change.doc.id);
            return;
          }
          listingMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
        });
        publishListings();
      },
      (error) => console.error("live boats snapshot error:", error)
    );

    if (currentUser?.uid) {
      const ownerBoatsQuery = query(collection(db, "boats"), where("ownerId", "==", currentUser.uid));
      ownerUnsubscribe = onSnapshot(
        ownerBoatsQuery,
        (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === "removed") {
              listingMap.delete(change.doc.id);
              return;
            }
            listingMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
          });
          publishListings();
        },
        (error) => console.error("owner boats snapshot error:", error)
      );
    }

    return () => {
      liveUnsubscribe();
      if (ownerUnsubscribe) ownerUnsubscribe();
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedBoat?.id) return;

    const latestBoat = boats.find((boat) => boat.id === selectedBoat.id);
    if (!latestBoat) {
      setSelectedBoat(null);
      setView("browse");
      return;
    }

    setSelectedBoat((current) => {
      if (!current) return latestBoat;
      return latestBoat.id === current.id ? latestBoat : current;
    });
  }, [boats, selectedBoat?.id]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setConversations([]);
      return;
    }

    const conversationsQuery = query(collection(db, "conversations"), where("participantIds", "array-contains", currentUser.uid));

    const unsubscribe = onSnapshot(
      conversationsQuery,
      (snapshot) => {
        const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
        setConversations(list);
      },
      (error) => console.error("conversations snapshot error:", error)
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedConversation?.id) {
      setMessages([]);
      return;
    }

    const messagesQuery = query(
      collection(db, "conversations", selectedConversation.id, "messages"),
      orderBy("createdAt", "asc")
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      setMessages(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
          createdAt: item.data().createdAt?.toDate?.() || null,
        }))
      );
    });

    return () => unsubscribe();
  }, [selectedConversation?.id]);

  useEffect(() => {
    if (!selectedBoat?.id || !selectedDate) {
      setBookedSlotsForDate([]);
      return;
    }

    const bookingsQuery = query(
      collection(db, "bookings"),
      where("boatId", "==", selectedBoat.id),
      where("date", "==", selectedDate)
    );

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      const unavailableSlots = getUnavailableSlotsForDate(list);
      setBookedSlotsForDate(unavailableSlots);

      if (selectedSlot && unavailableSlots.includes(selectedSlot)) {
        setSelectedSlot("");
      }
    });

    return () => unsubscribe();
  }, [selectedBoat?.id, selectedDate, selectedSlot]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setMyBookings([]);
      return;
    }

    const bookingsQuery = query(collection(db, "bookings"), where("userId", "==", currentUser.uid));

    const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
      const list = snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
      list.sort((left, right) => {
        const leftTime = left.updatedAt?.toMillis?.() || left.createdAt?.toMillis?.() || 0;
        const rightTime = right.updatedAt?.toMillis?.() || right.createdAt?.toMillis?.() || 0;
        return rightTime - leftTime;
      });
      setMyBookings(list);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!currentUser?.uid) {
      setUserReviews([]);
      return;
    }

    const reviewsQuery = query(collection(db, "reviews"), where("userId", "==", currentUser.uid));
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      setUserReviews(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!selectedBoat?.id) {
      setSelectedBoatReviews([]);
      return;
    }

    const reviewsQuery = query(collection(db, "reviews"), where("boatId", "==", selectedBoat.id));
    const unsubscribe = onSnapshot(reviewsQuery, (snapshot) => {
      const list = snapshot.docs.map((item) => ({
        id: item.id,
        ...item.data(),
        createdAt: item.data().createdAt?.toDate?.() || null,
      }));
      list.sort((left, right) => (right.createdAt?.getTime?.() || 0) - (left.createdAt?.getTime?.() || 0));
      setSelectedBoatReviews(list);
    });

    return () => unsubscribe();
  }, [selectedBoat?.id]);

  useEffect(() => {
    if (!currentUser?.uid || currentUserType !== "owner") return;

    const stripeParam = new URLSearchParams(window.location.search).get("stripe");
    if (!stripeParam) return;

    refreshStripeConnectStatus().finally(() => {
      setView("list-boat");
      window.history.replaceState({}, "", window.location.pathname);
    });
  }, [currentUser?.uid, currentUserType]);

  const showFeedback = (tone, title, message) => {
    setFeedback({ tone, title, message });
  };

  const upsertUserProfile = async (user, accountType) => {
    const userRef = doc(db, "users", user.uid);
    const snapshot = await getDoc(userRef);
    const existingData = snapshot.exists() ? snapshot.data() : {};
    const accountTypes = Array.from(new Set([...(existingData.accountTypes || []), accountType]));

    const payload = {
      uid: user.uid,
      email: user.email || existingData.email || "",
      displayName: user.displayName || existingData.displayName || (user.email ? user.email.split("@")[0] : "User"),
      photoURL: user.photoURL || existingData.photoURL || "",
      accountTypes,
      lastActiveType: accountType,
      createdAt: existingData.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, payload, { merge: true });
  };

  const refreshStripeConnectStatus = async () => {
    if (!currentUser?.uid) return null;

    setStripeLoading(true);
    try {
      const data = await authorizedJson("/api/get-stripe-connect-status", { method: "POST" });
      setStripeConnect(data.stripeConnect || null);
      return data.stripeConnect || null;
    } catch (error) {
      showFeedback("error", "Unable to refresh Stripe status", error.message);
      return null;
    } finally {
      setStripeLoading(false);
    }
  };

  const beginStripeOnboarding = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    setStripeLoading(true);
    try {
      const data = await authorizedJson("/api/create-stripe-connect-account", { method: "POST" });
      window.location.href = data.url;
    } catch (error) {
      showFeedback("error", "Stripe onboarding failed", error.message);
      setStripeLoading(false);
    }
  };

  const openStripeDashboard = async () => {
    setStripeLoading(true);
    try {
      const data = await authorizedJson("/api/create-stripe-dashboard-link", { method: "POST" });
      window.location.href = data.url;
    } catch (error) {
      showFeedback("error", "Unable to open Stripe", error.message);
      setStripeLoading(false);
    }
  };

  const handleGoogleSignIn = async (accountType) => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await upsertUserProfile(result.user, accountType);
      setShowAuthModal(false);
      showFeedback("success", "Signed in", "Your account is ready.");
    } catch (error) {
      if (error?.code === "auth/popup-closed-by-user") return;
      showFeedback("error", "Google sign-in failed", error.message);
    }
  };

  const handleEmailAuth = async ({ mode, role, email, password }) => {
    try {
      if (!email || !password) {
        showFeedback("warning", "Missing details", "Enter both your email and password to continue.");
        return;
      }

      const credentials =
        mode === "login"
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      await upsertUserProfile(credentials.user, role);
      setShowAuthModal(false);
      showFeedback("success", mode === "login" ? "Signed in" : "Account created", "You're ready to use the marketplace.");
    } catch (error) {
      showFeedback("error", "Authentication failed", error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedConversation(null);
    setSelectedBoat(null);
    setView("landing");
  };

  const switchAccountType = async (newType) => {
    if (!currentUser) return;

    await updateDoc(doc(db, "users", currentUser.uid), {
      lastActiveType: newType,
      accountTypes: Array.from(new Set([...(userProfile?.accountTypes || []), newType])),
      updatedAt: serverTimestamp(),
    });

    setCurrentUserType(newType);
    setView(newType === "owner" ? "list-boat" : "browse");
    if (newType === "owner") {
      refreshStripeConnectStatus();
    }
  };

  const openBoatDetail = (boat) => {
    setSelectedBoat(boat);
    setSelectedDate("");
    setSelectedSlot("");
    setView("boat-detail");
  };

  const startConversation = async (boat) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (!boat?.ownerId) {
      showFeedback("error", "Listing setup issue", "This listing is missing an owner record.");
      return;
    }

    if (boat.ownerId === currentUser.uid) {
      showFeedback("warning", "Owner account only", "Use a passenger account to test messaging your own listing.");
      return;
    }

    try {
      const conversationId = createConversationId(currentUser.uid, boat.ownerId, boat.id);
      const conversationRef = doc(db, "conversations", conversationId);
      const conversationSnapshot = await getDoc(conversationRef);

      if (!conversationSnapshot.exists()) {
        await setDoc(
          conversationRef,
          {
            boatId: boat.id,
            boatName: boat.name,
            boatImageUrl: boat.imageUrl || DEFAULT_BOAT_IMAGE,
            participantIds: [currentUser.uid, boat.ownerId],
            participantNames: {
              [currentUser.uid]: userProfile?.displayName || currentUser.displayName || "Passenger",
              [boat.ownerId]: boat.ownerName || "Owner",
            },
            lastMessage: "",
            lastMessageAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      setSelectedConversation({
        id: conversationId,
        ...(conversationSnapshot.exists() ? conversationSnapshot.data() : {}),
        boatId: boat.id,
        boatName: boat.name,
        participantIds: [currentUser.uid, boat.ownerId],
        participantNames: {
          [currentUser.uid]: userProfile?.displayName || currentUser.displayName || "Passenger",
          [boat.ownerId]: boat.ownerName || "Owner",
        },
      });
      setView("messages");
    } catch (error) {
      showFeedback("error", "Unable to start conversation", error.message);
    }
  };

  const sendMessage = async () => {
    if (!currentUser || !selectedConversation) return;

    const trimmedText = messageInput.trim();
    if (!trimmedText && !messageAttachment) return;

    setSendingMessage(true);
    setMessageError("");

    const previousInput = messageInput;
    const previousAttachment = messageAttachment;

    setMessageInput("");
    setMessageAttachment(null);

    try {
      let attachmentUrl = null;
      if (previousAttachment) {
        const uploadedAttachment = await uploadMessageAttachmentToCloudinary(previousAttachment);
        attachmentUrl = uploadedAttachment?.url || null;
      }

      const payload = {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || "User",
        text: trimmedText,
        attachmentUrl,
        attachmentType: attachmentUrl ? "image" : null,
        createdAt: serverTimestamp(),
      };

      await addDoc(collection(db, "conversations", selectedConversation.id, "messages"), payload);

      await updateDoc(doc(db, "conversations", selectedConversation.id), {
        lastMessage: trimmedText || (attachmentUrl ? "Attachment" : ""),
        lastMessageAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      setMessageInput(previousInput);
      setMessageAttachment(previousAttachment);
      setMessageError(error.message || "Message failed to send.");
    } finally {
      setSendingMessage(false);
    }
  };

  const submitRating = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (!selectedBoat?.id) return;
    if (selectedBoat.ownerId === currentUser.uid) {
      showFeedback("warning", "Owner reviews blocked", "Owners can't review their own listing.");
      return;
    }

    if (!hasConfirmedBookingForBoat) {
      showFeedback("warning", "Confirmed booking required", "You can leave a review after a confirmed charter.");
      return;
    }

    if (alreadyReviewed) {
      showFeedback("warning", "Review already submitted", "You've already rated this boat.");
      return;
    }

    const stars = Number(ratingValue);
    if (Number.isNaN(stars) || stars < 1 || stars > 5) {
      showFeedback("warning", "Choose a rating", "Pick a rating between 1 and 5 stars.");
      return;
    }

    try {
      await authorizedJson("/api/create-review", {
        method: "POST",
        body: JSON.stringify({
          boatId: selectedBoat.id,
          stars,
          text: ratingText.trim(),
        }),
      });

      setRatingValue(5);
      setRatingText("");
      showFeedback("success", "Thanks for the review", "Your rating is now reflected on the listing.");
    } catch (error) {
      showFeedback("error", "Unable to submit review", error.message);
    }
  };

  const updateListingField = (field, value) => {
    setListingErrors((current) => ({ ...current, [field]: undefined }));

    if (editingBoat) {
      setEditingBoat((current) => ({ ...current, [field]: value }));
    } else {
      setNewBoat((current) => ({ ...current, [field]: value }));
    }
  };

  const handleListingFilesChange = (files) => {
    if (editingBoat) {
      setEditImageFiles(files);
    } else {
      setNewBoatImages(files);
    }
  };

  const persistListing = async (mode) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    if (currentUserType !== "owner") {
      showFeedback("warning", "Owner mode required", "Switch to Owner mode to manage boat listings.");
      return;
    }

    const validationErrors = validateBoatForm(activeListingForm);
    setListingErrors(validationErrors);

    if (Object.values(validationErrors).some(Boolean)) {
      showFeedback("warning", "Listing needs attention", "Fix the highlighted fields before saving.");
      return;
    }

    setUploading(true);

    try {
      const uploadedMedia = await uploadImagesToCloudinary(activeListingFiles);
      const existingManualUrls = parseMediaUrlInput(activeListingForm?.mediaUrls);
      const ownerProfileForListing = {
        uid: currentUser.uid,
        email: currentUser.email || "",
        displayName: userProfile?.displayName || currentUser.displayName || "Owner",
      };

      const payload = normalizeBoatPayload(activeListingForm, uploadedMedia, ownerProfileForListing, stripeConnect || {});
      const existingMediaItems =
        mode === "edit"
          ? getBoatGalleryMedia(editingBoat).filter((item) => item.url && item.url !== DEFAULT_BOAT_IMAGE)
          : [];
      const mergedMediaItems =
        mode === "edit"
          ? sanitizeMediaItems([
              ...payload.mediaItems,
              ...(Array.isArray(existingMediaItems)
                ? existingMediaItems.filter((item) => existingManualUrls.includes(item.url) || item.url === activeListingForm.imageUrl)
                : []),
            ])
          : payload.mediaItems;
      const mergedImageUrls = mergedMediaItems.filter((item) => item.type === "image").map((item) => item.url);
      const coverMedia = mergedMediaItems.find((item) => item.type === "image") || mergedMediaItems.find((item) => item.type === "video");

      const finalPayload = {
        ...payload,
        mediaItems: mergedMediaItems,
        imageUrls: mergedImageUrls,
        imageUrl:
          coverMedia?.type === "video"
            ? coverMedia.thumbnailUrl || payload.imageUrl || DEFAULT_BOAT_IMAGE
            : coverMedia?.url || payload.imageUrl || DEFAULT_BOAT_IMAGE,
        rating: editingBoat?.rating || 0,
        reviews: editingBoat?.reviews || 0,
        updatedAt: serverTimestamp(),
      };

      if (mode === "edit" && editingBoat?.id) {
        await updateDoc(doc(db, "boats", editingBoat.id), finalPayload);
        showFeedback("success", "Listing updated", "Your listing changes are now live.");
        setSelectedBoat((current) => (current?.id === editingBoat.id ? { ...current, ...finalPayload } : current));
        setEditingBoat(null);
        setEditImageFiles([]);
        setView("boat-detail");
      } else {
        await addDoc(collection(db, "boats"), {
          ...finalPayload,
          createdAt: serverTimestamp(),
        });
        showFeedback("success", "Listing published", "Your boat is now available in the owner dashboard.");
        setNewBoat(createBoatFormState());
        setNewBoatImages([]);
        setView("list-boat");
      }
    } catch (error) {
      showFeedback("error", "Unable to save listing", error.message);
    } finally {
      setUploading(false);
    }
  };

  const createListing = () => persistListing("create");
  const saveListingEdits = () => persistListing("edit");

  const archiveListing = async () => {
    if (!selectedBoat?.id || !currentUser?.uid) return;

    setArchiveBusy(true);

    try {
      const relatedBookingsSnapshot = await getDocs(query(collection(db, "bookings"), where("boatId", "==", selectedBoat.id)));
      const upcomingActiveBookings = relatedBookingsSnapshot.docs
        .map((item) => item.data())
        .filter((booking) => ["confirmed", "pending_payment", "processing"].includes(booking.status))
        .filter((booking) => isUpcomingBooking(booking));

      await updateDoc(doc(db, "boats", selectedBoat.id), {
        status: "archived",
        bookingDisabled: true,
        archivedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      showFeedback(
        "success",
        upcomingActiveBookings.length ? "Listing archived safely" : "Listing removed from marketplace",
        upcomingActiveBookings.length
          ? "The listing is hidden from new guests, and existing bookings remain intact."
          : "The listing is now hidden from the public marketplace."
      );
      setConfirmArchiveOpen(false);
      setSelectedBoat(null);
      setView("browse");
    } catch (error) {
      showFeedback("error", "Unable to archive listing", error.message);
    } finally {
      setArchiveBusy(false);
    }
  };

  const beginCheckout = async () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    const validation = validateBookingSelection({
      boat: selectedBoat,
      date: selectedDate,
      slot: selectedSlot,
    });

    if (!validation.ok) {
      showFeedback("warning", "Booking details need attention", validation.error);
      return;
    }

    if (!canBoatAcceptBookings(selectedBoat)) {
      showFeedback("warning", "Booking unavailable", "This owner still needs to finish payout onboarding before guests can pay.");
      return;
    }

    setCheckoutBusy(true);
    try {
      const data = await authorizedJson("/api/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({
          boatId: selectedBoat.id,
          date: validation.normalizedDate,
          slot: validation.normalizedSlot,
        }),
      });

      window.location.href = data.url;
    } catch (error) {
      showFeedback("error", "Checkout failed", error.message);
    } finally {
      setCheckoutBusy(false);
    }
  };

  const featuredBoats = filteredBoats.slice(0, 3);
  const selectedBoatGalleryMedia = getBoatGalleryMedia(selectedBoat);
  const selectedBoatSlots = buildSlotsFromRules(selectedBoat?.availabilityRules || {});
  const availableSlotsForSelectedDate = selectedBoatSlots.filter((slot) => !bookedSlotsForDate.includes(slot));

  useEffect(() => {
    if (!selectedBoatGalleryMedia.length) return;
    if (activeGalleryIndex <= selectedBoatGalleryMedia.length - 1) return;
    setActiveGalleryIndex(0);
  }, [activeGalleryIndex, selectedBoatGalleryMedia.length]);

  const goToNextMedia = () => {
    if (!selectedBoatGalleryMedia.length) return;
    setActiveGalleryIndex((current) => (current + 1) % selectedBoatGalleryMedia.length);
  };

  const goToPreviousMedia = () => {
    if (!selectedBoatGalleryMedia.length) return;
    setActiveGalleryIndex((current) => (current - 1 + selectedBoatGalleryMedia.length) % selectedBoatGalleryMedia.length);
  };

  const goToView = (nextView) => {
    setIsMobileMenuOpen(false);
    setView(nextView);
  };

  const openAuthModal = () => {
    setIsMobileMenuOpen(false);
    setShowAuthModal(true);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((current) => !current);
  };

  const handleMobileAccountTypeChange = async (nextType) => {
    setIsMobileMenuOpen(false);
    await switchAccountType(nextType);
  };

  const handleMobileSignOut = async () => {
    setIsMobileMenuOpen(false);
    await handleSignOut();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50">
        <div className="text-center">
          <Anchor className="mx-auto mb-4 h-16 w-16 animate-pulse text-blue-600" />
          <p className="text-lg text-slate-600">Loading GTA Charter...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {showAuthModal ? (
        <AuthModal onClose={() => setShowAuthModal(false)} onGoogle={handleGoogleSignIn} onEmailAuth={handleEmailAuth} />
      ) : null}

      <ConfirmDialog
        open={confirmArchiveOpen}
        title="Archive this listing?"
        description="The listing will disappear from the marketplace, and new guests won't be able to book it. Existing bookings stay intact."
        confirmLabel="Archive listing"
        busy={archiveBusy}
        onCancel={() => setConfirmArchiveOpen(false)}
        onConfirm={archiveListing}
      />

      <header className="header-glass">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
          <div className="relative flex items-center justify-between gap-3 sm:gap-4">
            <button
              type="button"
              className="flex items-center gap-2.5 sm:gap-3"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setView("landing");
              }}
            >
              <div className="gradient-blue rounded-2xl p-2.5 shadow-blue sm:p-2.5">
                <Anchor className="h-5 w-5 text-white sm:h-6 sm:w-6" />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold bg-gradient-to-r from-blue-700 to-cyan-600 bg-clip-text text-transparent sm:text-2xl">
                  GTA Charter
                </div>
                <div className="text-[11px] text-slate-600 sm:text-xs">Lake Ontario Adventures</div>
              </div>
            </button>

            <div className="hidden tab-scroll items-center sm:flex">
              {currentUser ? (
                <>
                  {userProfile?.accountTypes?.length > 1 ? (
                    <select
                      value={currentUserType || "user"}
                      onChange={(event) => switchAccountType(event.target.value)}
                      className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-medium text-slate-700"
                    >
                      {(userProfile.accountTypes || []).map((type) => (
                        <option key={type} value={type}>
                          {type === "owner" ? "Owner" : "Passenger"}
                        </option>
                      ))}
                    </select>
                  ) : null}

                  <button onClick={() => setView("browse")} className="btn-ghost text-sm">
                    Browse
                  </button>
                  <button onClick={() => setView("messages")} className="btn-secondary text-sm">
                    Messages
                  </button>
                  <button onClick={() => setView("bookings")} className="btn-secondary text-sm">
                    My Bookings
                  </button>

                  {currentUserType === "owner" ? (
                    <button onClick={() => setView("list-boat")} className="btn-secondary text-sm">
                      <Plus className="h-4 w-4" />
                      List Boat
                    </button>
                  ) : (
                    <button onClick={() => switchAccountType("owner")} className="btn-secondary text-sm">
                      Become an owner
                    </button>
                  )}

                  <button onClick={handleSignOut} className="btn-ghost text-sm">
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </>
              ) : (
                <button onClick={() => setShowAuthModal(true)} className="btn btn-primary text-sm">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 sm:hidden">
              {currentUser ? (
                <>
                  <div className="mobile-nav-role">
                    {currentUserType === "owner" ? "Owner" : "Passenger"}
                  </div>
                  <button
                    type="button"
                    className={`mobile-nav-toggle ${isMobileMenuOpen ? "is-open" : ""}`}
                    onClick={toggleMobileMenu}
                    aria-expanded={isMobileMenuOpen}
                    aria-controls="mobile-navigation"
                    aria-haspopup="menu"
                    aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                  >
                    {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  </button>
                </>
              ) : (
                <button onClick={openAuthModal} className="btn btn-primary text-sm">
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
              )}
            </div>
          </div>

          {currentUser ? (
            <div
              id="mobile-navigation"
              className={`mobile-nav-panel sm:hidden ${isMobileMenuOpen ? "is-open" : ""}`}
              aria-hidden={!isMobileMenuOpen}
            >
              {userProfile?.accountTypes?.length > 1 ? (
                <div className="mobile-nav-panel__section">
                  <div className="mobile-nav-label">Mode</div>
                  <select
                    value={currentUserType || "user"}
                    onChange={(event) => handleMobileAccountTypeChange(event.target.value)}
                    className="select mobile-nav-select"
                  >
                    {(userProfile.accountTypes || []).map((type) => (
                      <option key={type} value={type}>
                        {type === "owner" ? "Owner" : "Passenger"}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="mobile-nav-panel__section">
                <div className="mobile-nav-label">Navigate</div>
                <div className="mobile-nav-items" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goToView("browse")}
                    className={`mobile-nav-item ${view === "browse" ? "is-active" : ""}`}
                  >
                    Browse
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goToView("messages")}
                    className={`mobile-nav-item ${view === "messages" ? "is-active" : ""}`}
                  >
                    Messages
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => goToView("bookings")}
                    className={`mobile-nav-item ${view === "bookings" ? "is-active" : ""}`}
                  >
                    My Bookings
                  </button>
                  {currentUserType === "owner" ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => goToView("list-boat")}
                      className={`mobile-nav-item ${["list-boat", "edit-boat"].includes(view) ? "is-active" : ""}`}
                    >
                      List Boat
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleMobileAccountTypeChange("owner")}
                      className="mobile-nav-item"
                    >
                      Become an owner
                    </button>
                  )}
                </div>
              </div>

              <div className="mobile-nav-panel__section">
                <button type="button" onClick={handleMobileSignOut} className="mobile-nav-signout">
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 pb-24 sm:py-6 md:pb-10">
        {feedback ? (
          <div className="mb-6">
            <StatusBanner tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
              {feedback.message}
            </StatusBanner>
          </div>
        ) : null}

        {view === "landing" ? (
          <div className="mobile-section-gap space-y-8 sm:space-y-10">
            <section className="relative overflow-hidden rounded-[28px] border border-white/60 bg-[radial-gradient(1200px_circle_at_20%_20%,rgba(56,189,248,0.22),transparent_55%),radial-gradient(900px_circle_at_80%_30%,rgba(37,99,235,0.18),transparent_55%),linear-gradient(to_bottom,rgba(255,255,255,0.85),rgba(255,255,255,0.55))] shadow-strong sm:rounded-3xl">
              <div className="relative px-5 py-10 sm:px-6 sm:py-14 md:px-12 md:py-20">
                <div className="max-w-3xl">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Premium local marketplace
                  </p>
                  <h1 className="mobile-heading-tight mt-4 text-[2.3rem] font-extrabold tracking-tight text-slate-950 sm:text-4xl md:text-6xl">
                    Charter boats with more
                    <span className="bg-gradient-to-r from-blue-700 via-cyan-600 to-emerald-500 bg-clip-text text-transparent">
                      {" "}trust, clarity, and polish
                    </span>
                  </h1>
                  <p className="mobile-subtle-copy mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-600 sm:text-base md:text-lg">
                    Browse premium GTA charters, message owners directly, and book securely through a production-style marketplace flow.
                  </p>

                  <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                    <button onClick={() => setView("browse")} className="btn btn-primary btn-lg">
                      Browse charters
                    </button>
                    {currentUserType === "owner" ? (
                      <button onClick={() => setView("list-boat")} className="btn btn-ghost btn-lg">
                        Manage listings
                      </button>
                    ) : (
                      <button onClick={() => (currentUser ? switchAccountType("owner") : setShowAuthModal(true))} className="btn btn-ghost btn-lg">
                        Become an owner
                      </button>
                    )}
                  </div>

                  <div className="mt-7 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 md:grid-cols-4">
                    {[
                      { key: "Secure checkout", value: "Stripe marketplace flow" },
                      { key: "Owner payouts", value: "Connect Express onboarding" },
                      { key: "Live inbox", value: "Clear message threads" },
                      { key: "Reliable booking", value: "Slot validation + holds" },
                    ].map((item) => (
                      <div key={item.key} className="mobile-surface rounded-2xl border border-white/60 bg-white/70 p-3.5 shadow-soft sm:p-4">
                        <div className="text-sm font-semibold text-slate-900">{item.key}</div>
                        <div className="mt-1 text-xs text-slate-600">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="mobile-heading-tight text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">Featured charters</h2>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">Refined listing cards with stronger availability and booking confidence.</p>
                </div>
                <button onClick={() => setView("browse")} className="btn btn-ghost sm:w-auto">
                  View all
                </button>
              </div>

              {featuredBoats.length === 0 ? (
                <div className="card p-8 text-center sm:p-10">
                  <Anchor className="mx-auto mb-4 h-14 w-14 text-slate-300" />
                  <div className="text-lg font-bold text-slate-900">No live charters yet</div>
                  <div className="mt-1 text-slate-600">Switch to owner mode to create the first polished listing.</div>
                </div>
              ) : (
                <div className="lux-msg-grid">
                  {featuredBoats.map((boat) => (
                    <button key={boat.id} type="button" onClick={() => openBoatDetail(boat)} className="card overflow-hidden text-left">
                      <div className="relative h-48 overflow-hidden sm:h-52">
                        <img src={getBoatCoverImage(boat)} alt={boat.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-black/10 to-transparent" />
                        <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800">
                          {boat.location}
                        </div>
                        <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900">
                          {formatPrice(boat.price)}
                        </div>
                        <div className="absolute bottom-4 left-4 right-4 text-white">
                          <div className="text-lg font-extrabold sm:text-xl">{boat.name}</div>
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-white/90">
                            <span className="inline-flex items-center gap-1">
                              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                              {boat.rating || 0} ({boat.reviews || 0})
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              Up to {boat.capacity}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {view === "browse" ? (
          <div>
            <div className="mb-6">
              <h2 className="mobile-heading-tight text-2xl font-bold text-slate-900 sm:text-3xl">Discover your next charter</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 sm:text-base">Browse only live listings with clearer pricing, messaging, and booking readiness.</p>
            </div>

            <div className="mb-6 tab-scroll">
              {LOCATIONS.map((location) => (
                <button
                  key={location}
                  onClick={() => setLocationFilter(location)}
                  className={`chip ${locationFilter === location ? "chip--active" : ""}`}
                >
                  {location}
                </button>
              ))}
            </div>

            {filteredBoats.length === 0 ? (
              <div className="card p-10 text-center sm:p-16">
                <Anchor className="mx-auto mb-4 h-16 w-16 text-slate-300" />
                <h3 className="text-xl font-bold text-slate-700">No live boats available yet</h3>
                <p className="mt-2 text-slate-500">Owners can save drafts first, then publish live once payouts and details are ready.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
                {filteredBoats.map((boat) => (
                  <button key={boat.id} type="button" onClick={() => openBoatDetail(boat)} className="card-premium overflow-hidden text-left">
                    <div className="relative h-48 overflow-hidden sm:h-52 lg:h-56">
                      <img src={getBoatCoverImage(boat)} alt={boat.name} className="h-full w-full object-cover" />
                      <div className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-slate-900">
                        {formatPrice(boat.price)}
                      </div>
                    </div>
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-bold text-slate-900 sm:text-xl">{boat.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-slate-600">
                            <MapPin className="h-4 w-4" />
                            {boat.location}
                          </div>
                        </div>
                        <span className="badge badge-emerald">{formatStatusLabel(getListingStatus(boat))}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 sm:mt-4">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          {boat.rating || 0} ({boat.reviews || 0})
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-4 w-4" />
                          Up to {boat.capacity}
                        </span>
                      </div>
                      <div className="mt-4 text-sm text-slate-500">{boat.type}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {view === "boat-detail" && selectedBoat ? (
          <div>
            <button onClick={() => setView("browse")} className="mb-3 btn-ghost sm:mb-4 sm:w-auto">
              Back to browse
            </button>

            {currentUserType === "owner" && selectedBoat.ownerId === currentUser?.uid ? (
              <div className="mb-4 flex flex-col gap-3 sm:flex-wrap">
                <button
                  onClick={() => {
                    setEditingBoat(boatToFormState(selectedBoat));
                    setEditImageFiles([]);
                    setListingErrors({});
                    setView("edit-boat");
                  }}
                  className="btn-secondary text-sm sm:w-auto"
                >
                  Edit listing
                </button>
                <button onClick={() => setConfirmArchiveOpen(true)} className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 sm:w-auto">
                  Archive listing
                </button>
                <div className="w-full min-w-0 flex-1">
                  <OwnerPayoutCard
                    compact
                    stripeConnect={stripeConnect}
                    loading={stripeLoading}
                    onConnect={beginStripeOnboarding}
                    onRefresh={refreshStripeConnectStatus}
                    onManage={openStripeDashboard}
                  />
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[28px] border-2 border-slate-200 bg-white shadow-strong sm:rounded-3xl">
              <div className="border-b border-sky-100 bg-[linear-gradient(180deg,rgba(248,252,255,0.92),rgba(239,246,255,0.66))] p-3 sm:p-4 md:p-5">
                <BoatMediaGallery
                  boatName={selectedBoat.name}
                  mediaItems={selectedBoatGalleryMedia}
                  activeIndex={activeGalleryIndex}
                  onSelect={setActiveGalleryIndex}
                  onOpen={(index) => {
                    setActiveGalleryIndex(index);
                    setIsMediaViewerOpen(true);
                  }}
                  onNext={goToNextMedia}
                  onPrevious={goToPreviousMedia}
                />
              </div>

              <div className="p-4 sm:p-6 md:p-8">
                <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <h2 className="mobile-heading-tight text-2xl font-bold text-slate-900 sm:text-3xl">{selectedBoat.name}</h2>
                      <span className={`badge ${selectedBoat.ownerStripeReady ? "badge-emerald" : "badge-amber"}`}>
                        {selectedBoat.ownerStripeReady ? "Instant booking enabled" : "Payout setup pending"}
                      </span>
                    </div>
                    <div className="mobile-inline-meta mt-3 text-sm text-slate-600 sm:text-base">
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        {selectedBoat.location}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Up to {selectedBoat.capacity} guests
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        {selectedBoat.rating || 0} ({selectedBoat.reviews || 0} reviews)
                      </span>
                    </div>
                  </div>

                  <div className="gradient-blue rounded-2xl px-5 py-4 text-white shadow-blue sm:px-6 sm:py-5">
                    <div className="text-sm opacity-90">Charter price</div>
                    <div className="text-2xl font-bold sm:text-3xl">{formatPrice(selectedBoat.price)}</div>
                    <div className="text-sm opacity-90">for {selectedBoat.bookingDurationHours || selectedBoat.availabilityRules?.slotLength || 4} hours</div>
                  </div>
                </div>

                <div className="mb-8 grid gap-6 md:grid-cols-2">
                  <div>
                    <h3 className="mb-3 text-xl font-bold text-slate-900">About this charter</h3>
                    <p className="leading-relaxed text-slate-700">{selectedBoat.description}</p>
                  </div>

                  <div>
                    <h3 className="mb-3 text-xl font-bold text-slate-900">Amenities</h3>
                    <div className="flex flex-wrap gap-2">
                      {sanitizeAmenityList(selectedBoat.amenities).length ? (
                        sanitizeAmenityList(selectedBoat.amenities).map((amenity) => (
                          <span key={amenity} className="badge badge-blue">
                            {amenity}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">No amenities listed yet.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 border-t border-sky-100 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-3 text-xl font-bold text-slate-900">Reviews</h3>
                      {selectedBoatReviews.length === 0 ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                          No reviews yet. The first confirmed guest can leave one after booking.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {selectedBoatReviews.slice(0, 3).map((review) => (
                            <div key={review.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                              <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                                <div className="font-semibold text-slate-900">{review.userName || "Passenger"}</div>
                                <div className="text-sm text-slate-500">{formatConversationTime(review.createdAt)}</div>
                              </div>
                              <div className="mt-2 text-sm font-semibold text-slate-700">{review.stars} / 5 stars</div>
                              {review.text ? <div className="mt-2 text-sm leading-relaxed text-slate-600">{review.text}</div> : null}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-sky-100 pt-6">
                      <h3 className="mb-3 text-xl font-bold text-slate-900">Leave a review</h3>
                      {!currentUser ? (
                        <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">
                          Sign in to review
                        </button>
                      ) : selectedBoat.ownerId === currentUser.uid ? (
                        <p className="text-sm text-slate-500">Owners can't review their own listings.</p>
                      ) : !hasConfirmedBookingForBoat ? (
                        <p className="text-sm text-slate-500">You can review once you've completed a confirmed charter.</p>
                      ) : alreadyReviewed ? (
                        <p className="text-sm text-slate-500">You've already reviewed this charter.</p>
                      ) : (
                        <div className="space-y-3">
                          <select value={ratingValue} onChange={(event) => setRatingValue(Number(event.target.value))} className="select max-w-xs">
                            {[5, 4, 3, 2, 1].map((value) => (
                              <option key={value} value={value}>
                                {value} star{value > 1 ? "s" : ""}
                              </option>
                            ))}
                          </select>
                          <textarea
                            rows={3}
                            className="textarea"
                            value={ratingText}
                            placeholder="Share what felt great about the charter."
                            onChange={(event) => setRatingText(event.target.value)}
                          />
                          <button onClick={submitRating} className="btn btn-primary">
                            Submit review
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mobile-booking-panel rounded-3xl border border-sky-100 bg-sky-50/70 p-4 sm:p-5">
                    <h3 className="text-xl font-bold text-slate-900">Book this charter</h3>
                    <p className="mt-1 text-sm text-slate-600">Availability updates live so stale or double-booked slots get blocked automatically.</p>

                    {!selectedBoat.ownerStripeReady ? (
                      <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        This owner is still completing Stripe payout onboarding, so checkout is temporarily disabled.
                      </div>
                    ) : null}

                    <div className="mt-5 space-y-4 sm:space-y-5">
                      <div>
                        <label className="label">Select date</label>
                        <DatePicker
                          selectedDate={selectedDate}
                          onSelectDate={(date) => {
                            setSelectedDate(normalizeDateInput(date));
                            setSelectedSlot("");
                          }}
                          rules={selectedBoat.availabilityRules || {}}
                        />
                      </div>

                      <div>
                        <label className="label">Available time slots</label>
                        {selectedDate ? (
                          availableSlotsForSelectedDate.length ? (
                            <div className="space-y-2.5">
                              {availableSlotsForSelectedDate.map((slot) => (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => setSelectedSlot(slot)}
                                  className={`w-full rounded-2xl px-4 py-3.5 text-left font-semibold transition ${
                                    selectedSlot === slot
                                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md"
                                      : "border-2 border-sky-200 bg-white text-slate-700 hover:border-blue-400"
                                  }`}
                                >
                                  <span className="inline-flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    {formatSlotLabel(slot)}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                              No remaining slots are available for {formatDateLabel(selectedDate)}.
                            </div>
                          )
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                            Choose a date to reveal currently available time slots.
                          </div>
                        )}
                      </div>

                      <button
                        onClick={beginCheckout}
                        disabled={!selectedDate || !selectedSlot || checkoutBusy || !selectedBoat.ownerStripeReady}
                        className="btn btn-primary w-full py-4 text-base"
                      >
                        {checkoutBusy ? "Preparing secure checkout..." : currentUser ? `Book now - ${formatPrice(selectedBoat.price)}` : "Sign in to book"}
                      </button>

                      <button onClick={() => startConversation(selectedBoat)} className="btn btn-secondary w-full py-4 text-base">
                        <MessageCircle className="h-5 w-5" />
                        Message owner
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {view === "messages" && currentUser ? (
          <MessagingWorkspace
            currentUser={currentUser}
            conversations={conversations}
            selectedConversation={selectedConversation}
            messages={messages}
            onSelectConversation={setSelectedConversation}
            onBack={() => setView("browse")}
            messageInput={messageInput}
            onMessageInputChange={setMessageInput}
            onAttachmentChange={setMessageAttachment}
            attachmentPreview={messageAttachmentPreview}
            onRemoveAttachment={() => setMessageAttachment(null)}
            onSendMessage={sendMessage}
            sendingMessage={sendingMessage}
            messageError={messageError}
          />
        ) : null}
        
        {view === "list-boat" && currentUser && currentUserType === "owner" ? (
          <BoatListingForm
            mode="create"
            form={newBoat}
            validationErrors={listingErrors}
            selectedFiles={newBoatImages}
            uploading={uploading || stripeLoading}
            stripeConnect={stripeConnect}
            ownerListings={ownerListings}
            onChange={updateListingField}
            onFilesChange={handleListingFilesChange}
            onSubmit={createListing}
            onCancel={() => setView("browse")}
            onConnectStripe={beginStripeOnboarding}
            onRefreshStripe={refreshStripeConnectStatus}
            onManageStripe={openStripeDashboard}
            onEditListing={(boat) => {
              setEditingBoat(boatToFormState(boat));
              setEditImageFiles([]);
              setListingErrors({});
              setView("edit-boat");
            }}
            onViewListing={openBoatDetail}
          />
        ) : null}

        {view === "edit-boat" && editingBoat && currentUserType === "owner" ? (
          <BoatListingForm
            mode="edit"
            form={editingBoat}
            validationErrors={listingErrors}
            selectedFiles={editImageFiles}
            uploading={uploading || stripeLoading}
            stripeConnect={stripeConnect}
            ownerListings={ownerListings}
            onChange={updateListingField}
            onFilesChange={handleListingFilesChange}
            onSubmit={saveListingEdits}
            onCancel={() => {
              setEditingBoat(null);
              setEditImageFiles([]);
              setView(selectedBoat ? "boat-detail" : "list-boat");
            }}
            onConnectStripe={beginStripeOnboarding}
            onRefreshStripe={refreshStripeConnectStatus}
            onManageStripe={openStripeDashboard}
            onEditListing={() => {}}
            onViewListing={openBoatDetail}
          />
        ) : null}

        {view === "bookings" && currentUser ? <BookingsPanel bookings={myBookings} onBack={() => setView("browse")} /> : null}

        {currentUser && currentUserType !== "owner" && ["list-boat", "edit-boat"].includes(view) ? (
          <div className="card p-8 text-center sm:p-10">
            <h3 className="text-xl font-bold text-slate-900">Switch to owner mode</h3>
            <p className="mt-2 text-slate-600">Use the account type switcher in the header to access the owner dashboard and Stripe payout setup.</p>
          </div>
        ) : null}

        {!currentUser && ["messages", "bookings", "list-boat", "edit-boat"].includes(view) ? (
          <div className="card p-8 text-center sm:p-10">
            <h3 className="text-xl font-bold text-slate-900">Sign in to continue</h3>
            <p className="mt-2 text-slate-600">Marketplace tools like bookings, messages, and owner dashboards require an account.</p>
            <div className="mt-5">
              <button onClick={() => setShowAuthModal(true)} className="btn btn-primary">
                Open sign in
              </button>
            </div>
          </div>
        ) : null}

        <MediaLightbox
          open={isMediaViewerOpen}
          mediaItems={selectedBoatGalleryMedia}
          activeIndex={activeGalleryIndex}
          title={selectedBoat?.name || "Boat media"}
          onClose={() => setIsMediaViewerOpen(false)}
          onNext={goToNextMedia}
          onPrevious={goToPreviousMedia}
          onSelect={setActiveGalleryIndex}
        />
      </main>

      <footer className="mt-14 border-t border-white/60 bg-white/60 backdrop-blur-md sm:mt-16">
        <div className="max-w-7xl mx-auto px-4 py-10 sm:py-12">
          <div className="grid gap-8 sm:gap-10 md:grid-cols-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-600 p-2 shadow-soft">
                  <Anchor className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-slate-950">GTA Charter</div>
                  <div className="text-xs text-slate-600">Lake Ontario Adventures</div>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-600">
                A refined portfolio marketplace connecting passengers with trusted local charter owners across the GTA.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Explore</div>
              <button onClick={() => setView("browse")} className="footer-link">
                Browse Charters
              </button>
              <button onClick={() => setView("messages")} className="footer-link">
                Messages
              </button>
              <button onClick={() => setView("bookings")} className="footer-link">
                My Bookings
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Owners</div>
              <button onClick={() => (currentUser ? switchAccountType("owner") : setShowAuthModal(true))} className="footer-link">
                Owner Dashboard
              </button>
              <button onClick={() => setView("list-boat")} className="footer-link">
                List a Boat
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-extrabold text-slate-950">Marketplace notes</div>
              <div className="text-sm text-slate-600">
                Payments route through Stripe Connect Express. Live bookings stay blocked until owner payouts are ready.
              </div>
              <div className="pt-4 text-xs text-slate-500">
                (c) {new Date().getFullYear()} GTA Charter. Portfolio project build.
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
