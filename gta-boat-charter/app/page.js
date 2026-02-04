"use client";

import React, { useState, useEffect } from 'react';
import { Calendar, MapPin, DollarSign, Clock, MessageCircle, Anchor, Star, Users, Send, X, Plus, Image as ImageIcon, Check } from 'lucide-react';

// Mock data for demonstration
const INITIAL_BOATS = [
  {
    id: 1,
    name: "Summer Breeze",
    owner: "John Mitchell",
    ownerId: "owner1",
    location: "Port Credit",
    type: "Sailboat",
    capacity: 6,
    price: 250,
    rating: 4.8,
    reviews: 24,
    image: "https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=800&q=80",
    description: "Beautiful 35ft sailboat perfect for sunset cruises. Fully equipped with safety gear and comfortable seating.",
    amenities: ["Life jackets", "Cooler", "Sound system", "Fishing gear"],
    availability: [
      { date: "2026-07-15", slots: ["09:00-13:00", "14:00-18:00"] },
      { date: "2026-07-16", slots: ["09:00-13:00", "14:00-18:00", "19:00-22:00"] }
    ]
  },
  {
    id: 2,
    name: "Wave Runner",
    owner: "Sarah Chen",
    ownerId: "owner2",
    location: "Toronto Harbour",
    type: "Motor Yacht",
    capacity: 10,
    price: 450,
    rating: 4.9,
    reviews: 31,
    image: "https://images.unsplash.com/photo-1605281317010-fe5ffe798166?w=800&q=80",
    description: "Luxurious motor yacht with spacious deck and modern amenities. Perfect for parties and corporate events.",
    amenities: ["Bar", "Bathroom", "Sound system", "WiFi", "Catering available"],
    availability: [
      { date: "2026-07-15", slots: ["10:00-14:00", "15:00-19:00"] },
      { date: "2026-07-17", slots: ["10:00-14:00", "15:00-19:00"] }
    ]
  },
  {
    id: 3,
    name: "Lake Explorer",
    owner: "Mike Thompson",
    ownerId: "owner3",
    location: "Hamilton Harbour",
    type: "Pontoon",
    capacity: 8,
    price: 180,
    rating: 4.7,
    reviews: 18,
    image: "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    description: "Comfortable pontoon boat ideal for families. Great for swimming and relaxing on the water.",
    amenities: ["Ladder", "Cooler", "Sun shade", "Life jackets"],
    availability: [
      { date: "2026-07-15", slots: ["09:00-13:00", "14:00-18:00"] },
      { date: "2026-07-16", slots: ["09:00-13:00"] }
    ]
  }
];

const LOCATIONS = ["All Locations", "Port Credit", "Toronto Harbour", "Hamilton Harbour"];

export default function BoatCharterPlatform() {
  const [view, setView] = useState('browse'); // browse, boat-detail, my-bookings, messages, owner-dashboard, list-boat
  const [userType, setUserType] = useState('user'); // user or owner
  const [boats, setBoats] = useState(INITIAL_BOATS);
  const [selectedBoat, setSelectedBoat] = useState(null);
  const [locationFilter, setLocationFilter] = useState('All Locations');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookings, setBookings] = useState([]);
  const [messages, setMessages] = useState([
    { id: 1, boatId: 1, sender: 'John Mitchell', text: 'Looking forward to your charter!', timestamp: new Date('2026-07-10T14:30:00'), isOwner: true },
    { id: 2, boatId: 1, sender: 'You', text: 'Thanks! Can we bring our own food?', timestamp: new Date('2026-07-10T14:45:00'), isOwner: false },
    { id: 3, boatId: 1, sender: 'John Mitchell', text: 'Absolutely! Just no red wine on the white cushions please 😊', timestamp: new Date('2026-07-10T15:00:00'), isOwner: true }
  ]);
  const [messageInput, setMessageInput] = useState('');
  const [newBoat, setNewBoat] = useState({
    name: '',
    location: 'Port Credit',
    type: 'Sailboat',
    capacity: 4,
    price: 200,
    description: '',
    amenities: ''
  });
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const filteredBoats = locationFilter === 'All Locations' 
    ? boats 
    : boats.filter(boat => boat.location === locationFilter);

  const handleBooking = () => {
    if (!selectedDate || !selectedSlot) {
      alert('Please select a date and time slot');
      return;
    }
    setShowPaymentModal(true);
  };

  const completeBooking = () => {
    const booking = {
      id: Date.now(),
      boatId: selectedBoat.id,
      boatName: selectedBoat.name,
      date: selectedDate,
      slot: selectedSlot,
      price: selectedBoat.price,
      status: 'confirmed',
      owner: selectedBoat.owner
    };
    setBookings([...bookings, booking]);
    setShowPaymentModal(false);
    setView('my-bookings');
    
    // Remove booked slot from availability
    const updatedBoats = boats.map(boat => {
      if (boat.id === selectedBoat.id) {
        return {
          ...boat,
          availability: boat.availability.map(avail => {
            if (avail.date === selectedDate) {
              return {
                ...avail,
                slots: avail.slots.filter(slot => slot !== selectedSlot)
              };
            }
            return avail;
          })
        };
      }
      return boat;
    });
    setBoats(updatedBoats);
  };

  const sendMessage = () => {
    if (!messageInput.trim()) return;
    const newMessage = {
      id: Date.now(),
      boatId: selectedBoat.id,
      sender: 'You',
      text: messageInput,
      timestamp: new Date(),
      isOwner: false
    };
    setMessages([...messages, newMessage]);
    setMessageInput('');
  };

  const addNewBoat = () => {
    if (!newBoat.name || !newBoat.description) {
      alert('Please fill in all required fields');
      return;
    }
    
    const boat = {
      id: Date.now(),
      ...newBoat,
      owner: "Your Name",
      ownerId: "currentUser",
      rating: 0,
      reviews: 0,
      image: "https://images.unsplash.com/photo-1569263979104-865ab7cd8d13?w=800&q=80",
      amenities: newBoat.amenities.split(',').map(a => a.trim()),
      availability: [
        { date: "2026-07-15", slots: ["09:00-13:00", "14:00-18:00"] },
        { date: "2026-07-16", slots: ["09:00-13:00", "14:00-18:00"] }
      ]
    };
    
    setBoats([...boats, boat]);
    setView('owner-dashboard');
    setNewBoat({
      name: '',
      location: 'Port Credit',
      type: 'Sailboat',
      capacity: 4,
      price: 200,
      description: '',
      amenities: ''
    });
  };

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
              <button
                onClick={() => setUserType(userType === 'user' ? 'owner' : 'user')}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg text-sm font-medium shadow-md hover:shadow-lg transition-all"
              >
                {userType === 'user' ? 'Switch to Owner' : 'Switch to User'}
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
                      src={boat.image}
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
                        <span className="font-semibold text-slate-900">{boat.rating}</span>
                        <span className="text-slate-500 text-sm">({boat.reviews})</span>
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
                src={selectedBoat.image}
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
                      <span className="font-semibold text-lg">{selectedBoat.rating}</span>
                      <span className="text-slate-500">({selectedBoat.reviews} reviews)</span>
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
                      {selectedBoat.amenities.map((amenity, idx) => (
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
                        {selectedBoat.availability.map(avail => (
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
                          .find(avail => avail.date === selectedDate)
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
                      onClick={() => setView('messages')}
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

        {/* My Bookings View */}
        {view === 'my-bookings' && (
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
            
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-sky-100">
              {selectedBoat ? (
                <div className="flex flex-col h-[600px]">
                  <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{selectedBoat.name}</h3>
                      <p className="text-sm opacity-90">with {selectedBoat.owner}</p>
                    </div>
                    <button
                      onClick={() => setSelectedBoat(null)}
                      className="p-2 hover:bg-white/20 rounded-lg transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages
                      .filter(msg => msg.boatId === selectedBoat.id)
                      .map(msg => (
                        <div
                          key={msg.id}
                          className={`flex ${msg.isOwner ? 'justify-start' : 'justify-end'}`}
                        >
                          <div className={`max-w-[80%] md:max-w-[60%] ${
                            msg.isOwner 
                              ? 'bg-slate-100 text-slate-900' 
                              : 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                          } rounded-2xl px-4 py-3`}>
                            <div className="font-medium text-sm mb-1 opacity-90">
                              {msg.sender}
                            </div>
                            <div>{msg.text}</div>
                            <div className={`text-xs mt-1 ${msg.isOwner ? 'text-slate-500' : 'text-white/70'}`}>
                              {msg.timestamp.toLocaleTimeString('en-US', { 
                                hour: 'numeric', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        </div>
                      ))
                    }
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
                <div className="p-12 text-center">
                  <MessageCircle className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">Select a conversation</h3>
                  <p className="text-slate-500">Choose a boat to view your messages</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Owner Dashboard */}
        {view === 'owner-dashboard' && (
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-6">Owner Dashboard</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Total Boats</h3>
                  <Anchor className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">{boats.filter(b => b.ownerId === "currentUser").length}</div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Active Bookings</h3>
                  <Calendar className="w-8 h-8 text-green-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">0</div>
              </div>
              
              <div className="bg-white rounded-xl p-6 shadow-lg border border-sky-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-slate-600 font-medium">Total Revenue</h3>
                  <DollarSign className="w-8 h-8 text-cyan-600" />
                </div>
                <div className="text-3xl font-bold text-slate-900">$0</div>
              </div>
            </div>

            <h3 className="text-2xl font-bold text-slate-900 mb-4">Your Boats</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {boats.filter(b => b.ownerId === "currentUser").map(boat => (
                <div key={boat.id} className="bg-white rounded-xl overflow-hidden shadow-lg border border-sky-100">
                  <img src={boat.image} alt={boat.name} className="w-full h-40 object-cover" />
                  <div className="p-4">
                    <h4 className="font-bold text-lg text-slate-900 mb-2">{boat.name}</h4>
                    <div className="text-sm text-slate-600 mb-3">{boat.location}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-blue-600 font-bold">${boat.price}/4hrs</span>
                      <button className="text-blue-600 hover:text-blue-700 font-medium">
                        Manage →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              
              {boats.filter(b => b.ownerId === "currentUser").length === 0 && (
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
        {view === 'list-boat' && (
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

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">Complete Booking</h3>
            
            <div className="bg-blue-50 rounded-xl p-4 mb-6 border border-blue-200">
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Boat:</span>
                <span className="font-semibold text-slate-900">{selectedBoat.name}</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Date:</span>
                <span className="font-semibold text-slate-900">
                  {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-slate-600">Time:</span>
                <span className="font-semibold text-slate-900">{selectedSlot}</span>
              </div>
              <div className="border-t border-blue-200 mt-3 pt-3 flex justify-between">
                <span className="font-bold text-slate-900">Total:</span>
                <span className="font-bold text-blue-600 text-xl">${selectedBoat.price}</span>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <input
                type="text"
                placeholder="Card Number"
                className="w-full px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="MM/YY"
                  className="px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="CVV"
                  className="px-4 py-3 border border-sky-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={completeBooking}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 text-white py-3 rounded-lg font-bold hover:shadow-xl transition-all"
              >
                Pay ${selectedBoat.price}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-6 py-3 border-2 border-slate-300 text-slate-700 rounded-lg font-bold hover:bg-slate-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
