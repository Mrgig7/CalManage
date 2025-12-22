import { useState, useMemo, useCallback, useEffect } from 'react';
import { useCalendar } from '../../context/CalendarContext';
import { useAuth } from '../../context/AuthContext';
import { X, Calendar, Clock, AlignLeft, Check, Sun, Video, Link2, Users, Search, Loader2, UserCheck, UserX, Sparkles, ChevronRight, User, Briefcase, GraduationCap, Heart, Plane, DollarSign, Tag } from 'lucide-react';
import GlassPanel from '../UI/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';

const EventModal = ({ isOpen, onClose, selectedDate, initialStartTime, initialEndTime }) => {
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [description, setDescription] = useState('');
  const [selectionMode, setSelectionMode] = useState('single');
  const [calendarId, setCalendarId] = useState('');
  const [selectedCalendarIds, setSelectedCalendarIds] = useState(null);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [error, setError] = useState('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [eventDate, setEventDate] = useState('');
  
  // Category state
  const [category, setCategory] = useState('');
  
  // Meeting state
  const [isMeeting, setIsMeeting] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState('zoom');
  
  // Attendees state
  const [attendees, setAttendees] = useState([]);
  const [attendeeSearch, setAttendeeSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [attendeeAvailability, setAttendeeAvailability] = useState({});
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  // Scheduling assistant state
  const [showSchedulingAssistant, setShowSchedulingAssistant] = useState(false);
  const [freeSlots, setFreeSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [meetingDuration, setMeetingDuration] = useState(30);

  const { calendars, sharedCalendars, addEvent } = useCalendar();
  const { token } = useAuth();

  const personalCalendar = useMemo(
    () => calendars.find(c => c.isDefault) || calendars[0],
    [calendars]
  );

  const editableCalendars = useMemo(() => {
    try {
      const own = calendars.map(c => ({ ...c, role: 'owner', isShared: false }));
      const sharedEditable = sharedCalendars.filter(c => c.role === 'editor');
      const all = [...own, ...sharedEditable];
      if (!personalCalendar) {
        return all;
      }
      const sorted = [...all].sort((a, b) => {
        if (a._id === personalCalendar._id) return -1;
        if (b._id === personalCalendar._id) return 1;
        return a.name.localeCompare(b.name);
      });
      return sorted;
    } catch {
      return personalCalendar ? [personalCalendar] : [];
    }
  }, [calendars, sharedCalendars, personalCalendar]);

  const resetForm = useCallback(() => {
    setTitle('');
    setStart('');
    setEnd('');
    setDescription('');
    setSelectionMode('single');
    setCalendarId('');
    setSelectedCalendarIds(null);
    setCalendarSearch('');
    setError('');
    setIsAllDay(false);
    setEventDate('');
    setCategory('');
    // Reset meeting fields
    setIsMeeting(false);
    setMeetingLink('');
    setMeetingPlatform('zoom');
    setAttendees([]);
    setAttendeeSearch('');
    setSearchResults([]);
    setAttendeeAvailability({});
    setShowSchedulingAssistant(false);
    setFreeSlots([]);
  }, []);

  // Pre-populate times when modal opens with clicked time slot
  useEffect(() => {
    if (isOpen && selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setEventDate(dateStr);
      if (initialStartTime) {
        setStart(initialStartTime);
      } else {
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        setStart(`${dateStr}T${hours}:${minutes}`);
      }
      if (initialEndTime) {
        setEnd(initialEndTime);
      } else {
        const endHour = (selectedDate.getHours() + 1) % 24;
        setEnd(`${dateStr}T${endHour.toString().padStart(2, '0')}:00`);
      }
    }
  }, [isOpen, selectedDate, initialStartTime, initialEndTime]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  const defaultCalendarId = useMemo(() => {
    if (personalCalendar && personalCalendar._id) return personalCalendar._id;
    return editableCalendars[0]?._id || '';
  }, [personalCalendar, editableCalendars]);

  const effectiveCalendarId = calendarId || defaultCalendarId;
  const effectiveSelectedCalendarIds = useMemo(() => {
    return selectedCalendarIds ?? (defaultCalendarId ? [defaultCalendarId] : []);
  }, [selectedCalendarIds, defaultCalendarId]);

  const resolvedTargetCalendarIds = useMemo(() => {
    if (selectionMode === 'all') {
      return editableCalendars.map(c => c._id);
    }
    if (selectionMode === 'multiple') {
      return editableCalendars
        .map(c => c._id)
        .filter(id => effectiveSelectedCalendarIds.includes(id));
    }
    if (selectionMode === 'single') {
      return effectiveCalendarId ? [effectiveCalendarId] : [];
    }
    return [];
  }, [selectionMode, editableCalendars, effectiveSelectedCalendarIds, effectiveCalendarId]);

  // Search users for attendees
  const handleAttendeeSearch = useCallback(async (query) => {
    setAttendeeSearch(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setSearchLoading(true);
    try {
      const res = await fetch(`http://localhost:5000/api/availability/users/search?q=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        // Filter out already added attendees
        const filtered = data.filter(u => !attendees.find(a => a.email === u.email));
        setSearchResults(filtered);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearchLoading(false);
    }
  }, [token, attendees]);

  // Add attendee
  const addAttendee = useCallback((user) => {
    setAttendees(prev => [...prev, { 
      userId: user._id, 
      email: user.email, 
      name: user.name,
      status: 'pending'
    }]);
    setAttendeeSearch('');
    setSearchResults([]);
  }, []);

  // Add attendee by email (for non-registered users)
  const addAttendeeByEmail = useCallback(() => {
    const email = attendeeSearch.trim().toLowerCase();
    if (email && email.includes('@') && !attendees.find(a => a.email === email)) {
      setAttendees(prev => [...prev, { 
        email, 
        name: email.split('@')[0],
        status: 'pending'
      }]);
      setAttendeeSearch('');
      setSearchResults([]);
    }
  }, [attendeeSearch, attendees]);

  // Remove attendee
  const removeAttendee = useCallback((email) => {
    setAttendees(prev => prev.filter(a => a.email !== email));
    setAttendeeAvailability(prev => {
      const next = { ...prev };
      delete next[email];
      return next;
    });
  }, []);

  // Check availability for all attendees
  const checkAvailability = useCallback(async () => {
    if (attendees.length === 0 || !start || !end) return;
    
    setCheckingAvailability(true);
    try {
      const res = await fetch('http://localhost:5000/api/availability/check', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          emails: attendees.map(a => a.email),
          startTime: start,
          endTime: end
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const availMap = {};
        data.forEach(item => {
          availMap[item.email] = item;
        });
        setAttendeeAvailability(availMap);
      }
    } catch (err) {
      console.error('Availability check error:', err);
    } finally {
      setCheckingAvailability(false);
    }
  }, [attendees, start, end, token]);

  // Auto-check availability when attendees or time changes
  useEffect(() => {
    if (isMeeting && attendees.length > 0 && start && end) {
      const timer = setTimeout(checkAvailability, 500);
      return () => clearTimeout(timer);
    }
  }, [isMeeting, attendees, start, end, checkAvailability]);

  // Find free slots using scheduling assistant
  const findFreeSlots = useCallback(async () => {
    if (attendees.length === 0) return;
    
    setLoadingSlots(true);
    try {
      const res = await fetch('http://localhost:5000/api/availability/slots', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          emails: attendees.map(a => a.email),
          date: eventDate || start?.split('T')[0],
          durationMinutes: meetingDuration
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setFreeSlots(data.freeSlots || []);
      }
    } catch (err) {
      console.error('Find slots error:', err);
    } finally {
      setLoadingSlots(false);
    }
  }, [attendees, eventDate, start, meetingDuration, token]);

  // Select a time slot from scheduling assistant
  const selectTimeSlot = useCallback((slot) => {
    setStart(slot.start.replace('Z', '').slice(0, 16));
    const endTime = new Date(slot.end);
    setEnd(endTime.toISOString().replace('Z', '').slice(0, 16));
    setShowSchedulingAssistant(false);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const dateStr = eventDate || (selectedDate ? selectedDate.toISOString().split('T')[0] : '');
    const defaultStart = dateStr ? `${dateStr}T09:00` : '';
    const defaultEnd = dateStr ? `${dateStr}T10:00` : '';

    if (resolvedTargetCalendarIds.length === 0) {
      setError('Select at least one calendar that allows editing.');
      return;
    }

    if (!category) {
      setError('Please select an event category.');
      return;
    }

    // For all-day events, set times to start/end of day
    let eventStart, eventEnd;
    if (isAllDay) {
      eventStart = new Date(`${dateStr}T00:00:00`);
      eventEnd = new Date(`${dateStr}T23:59:59`);
    } else {
      eventStart = new Date(start || defaultStart);
      eventEnd = new Date(end || defaultEnd);
    }

    const eventData = {
      title,
      category,
      start: eventStart,
      end: eventEnd,
      description,
      allDay: isAllDay,
      // Meeting fields
      isMeeting,
      meetingLink: isMeeting ? meetingLink : undefined,
      meetingPlatform: isMeeting ? meetingPlatform : undefined,
      attendees: isMeeting ? attendees.map(a => ({
        user: a.userId,
        email: a.email,
        status: 'pending'
      })) : undefined,
    };

    let successCount = 0;
    let lastError = '';

    for (const id of resolvedTargetCalendarIds) {
      const result = await addEvent(id, eventData);
      if (result && result.success) {
        successCount += 1;
      } else if (result && result.error) {
        lastError = result.error;
      }
    }

    if (successCount === 0) {
      setError(lastError || 'Unable to create event.');
      return;
    }

    handleClose();
  };

  const filteredCalendars = editableCalendars.filter(c =>
    c.name.toLowerCase().includes(calendarSearch.toLowerCase())
  );

  const platformOptions = [
    { id: 'zoom', label: 'Zoom', color: 'from-blue-600 to-blue-700' },
    { id: 'teams', label: 'Teams', color: 'from-purple-600 to-indigo-600' },
    { id: 'meet', label: 'Google Meet', color: 'from-green-600 to-teal-600' },
    { id: 'other', label: 'Other', color: 'from-gray-600 to-gray-700' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            className="w-full max-w-xl relative z-10"
          >
            <GlassPanel className="p-0 border border-white/10 shadow-2xl bg-dark-bg/90 backdrop-blur-2xl max-h-[90vh] flex flex-col">
              <div className="p-6 border-b border-white/5 flex justify-between items-center flex-shrink-0">
                <h3 className="text-xl font-bold text-white">
                  {isMeeting ? 'Schedule Meeting' : 'Create Event'}
                </h3>
                <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Title */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300">Event Title</label>
                    <input
                      type="text"
                      required
                      placeholder={isMeeting ? "e.g., Team Standup" : "e.g., Team Sync"}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>

                  {/* Event Type Toggle - Meeting vs Regular Event */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsMeeting(false)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        !isMeeting
                          ? 'bg-blue-600/20 border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className={`text-sm font-medium flex items-center gap-2 ${!isMeeting ? 'text-blue-300' : 'text-gray-300'}`}>
                        <Calendar className="w-4 h-4" />
                        Event
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Personal calendar entry</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMeeting(true)}
                      className={`p-3 rounded-xl border transition-all text-left ${
                        isMeeting
                          ? 'bg-purple-600/20 border-purple-500/50 shadow-[0_0_15px_rgba(147,51,234,0.15)]'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className={`text-sm font-medium flex items-center gap-2 ${isMeeting ? 'text-purple-300' : 'text-gray-300'}`}>
                        <Video className="w-4 h-4" />
                        Meeting
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">Invite attendees</div>
                    </button>
                  </div>

                  {/* Event Category Selector - REQUIRED */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                      <Tag className="w-4 h-4 text-teal-400" />
                      Category <span className="text-red-400">*</span>
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {[
                        { id: 'personal', label: 'Personal', icon: User, color: 'blue', desc: 'Private tasks & reminders' },
                        { id: 'business', label: 'Business', icon: Briefcase, color: 'indigo', desc: 'Work & meetings' },
                        { id: 'academic', label: 'Academic', icon: GraduationCap, color: 'purple', desc: 'Classes & exams' },
                        { id: 'health', label: 'Health', icon: Heart, color: 'rose', desc: 'Fitness & medical' },
                        { id: 'social', label: 'Social', icon: Users, color: 'amber', desc: 'Gatherings & parties' },
                        { id: 'travel', label: 'Travel', icon: Plane, color: 'cyan', desc: 'Trips & bookings' },
                        { id: 'finance', label: 'Finance', icon: DollarSign, color: 'emerald', desc: 'Bills & payments' },
                      ].map((cat) => {
                        const Icon = cat.icon;
                        const isSelected = category === cat.id;
                        const colorMap = {
                          blue: { bg: 'bg-blue-600/20', border: 'border-blue-500/50', text: 'text-blue-300', shadow: 'shadow-blue-500/15' },
                          indigo: { bg: 'bg-indigo-600/20', border: 'border-indigo-500/50', text: 'text-indigo-300', shadow: 'shadow-indigo-500/15' },
                          purple: { bg: 'bg-purple-600/20', border: 'border-purple-500/50', text: 'text-purple-300', shadow: 'shadow-purple-500/15' },
                          rose: { bg: 'bg-rose-600/20', border: 'border-rose-500/50', text: 'text-rose-300', shadow: 'shadow-rose-500/15' },
                          amber: { bg: 'bg-amber-600/20', border: 'border-amber-500/50', text: 'text-amber-300', shadow: 'shadow-amber-500/15' },
                          cyan: { bg: 'bg-cyan-600/20', border: 'border-cyan-500/50', text: 'text-cyan-300', shadow: 'shadow-cyan-500/15' },
                          emerald: { bg: 'bg-emerald-600/20', border: 'border-emerald-500/50', text: 'text-emerald-300', shadow: 'shadow-emerald-500/15' },
                        };
                        const colors = colorMap[cat.color];
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setCategory(cat.id)}
                            className={`p-2.5 rounded-xl border transition-all text-left ${
                              isSelected
                                ? `${colors.bg} ${colors.border} shadow-lg ${colors.shadow}`
                                : 'bg-white/5 border-white/10 hover:bg-white/10'
                            }`}
                          >
                            <div className={`text-xs font-medium flex items-center gap-1.5 ${isSelected ? colors.text : 'text-gray-300'}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {cat.label}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* All Day Toggle */}
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 cursor-pointer">
                      <Sun className="w-4 h-4 text-amber-400" />
                      All Day Event
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAllDay(!isAllDay)}
                      className={`relative w-12 h-6 rounded-full transition-all duration-300 ${
                        isAllDay 
                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 shadow-lg shadow-amber-500/30' 
                          : 'bg-white/10'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${
                        isAllDay ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>

                  {/* Date & Time */}
                  {!isAllDay && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                           <Clock className="w-4 h-4 text-blue-400" /> Start
                        </label>
                        <input
                          type="datetime-local"
                          required={!isAllDay}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                          value={start}
                          onChange={(e) => setStart(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                           <Clock className="w-4 h-4 text-blue-400" /> End
                        </label>
                        <input
                          type="datetime-local"
                          required={!isAllDay}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-sm"
                          value={end}
                          onChange={(e) => setEnd(e.target.value)}
                        />
                      </div>
                    </div>
                  )}

                  {/* Date Only - Shown when All Day */}
                  {isAllDay && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-amber-400" /> Date
                      </label>
                      <input
                        type="date"
                        required
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 text-sm"
                        value={eventDate}
                        onChange={(e) => {
                          setEventDate(e.target.value);
                          setStart(`${e.target.value}T00:00`);
                          setEnd(`${e.target.value}T23:59`);
                        }}
                      />
                    </div>
                  )}

                  {/* Meeting Details - Only shown when isMeeting */}
                  {isMeeting && (
                    <>
                      {/* Platform Selection */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Video className="w-4 h-4 text-purple-400" /> Platform
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                          {platformOptions.map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setMeetingPlatform(opt.id)}
                              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${
                                meetingPlatform === opt.id
                                  ? `bg-gradient-to-r ${opt.color} border-transparent text-white shadow-lg`
                                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Meeting Link */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                          <Link2 className="w-4 h-4 text-green-400" /> Meeting Link
                        </label>
                        <input
                          type="url"
                          placeholder="https://zoom.us/j/..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500/50 text-sm"
                          value={meetingLink}
                          onChange={(e) => setMeetingLink(e.target.value)}
                        />
                      </div>

                      {/* Attendees */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                            <Users className="w-4 h-4 text-cyan-400" /> Attendees
                          </label>
                          {attendees.length > 0 && !isAllDay && (
                            <button
                              type="button"
                              onClick={() => setShowSchedulingAssistant(!showSchedulingAssistant)}
                              className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1"
                            >
                              <Sparkles className="w-3 h-3" />
                              Find Available Time
                            </button>
                          )}
                        </div>

                        {/* Attendee Search */}
                        <div className="relative">
                          <div className="flex gap-2">
                            <div className="relative flex-1">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                              <input
                                type="text"
                                placeholder="Search by name or email..."
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 text-sm"
                                value={attendeeSearch}
                                onChange={(e) => handleAttendeeSearch(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    addAttendeeByEmail();
                                  }
                                }}
                              />
                              {searchLoading && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
                              )}
                            </div>
                          </div>

                          {/* Search Results Dropdown */}
                          {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-dark-bg/95 border border-white/10 rounded-xl overflow-hidden z-20 shadow-xl">
                              {searchResults.map(user => (
                                <div
                                  key={user._id}
                                  onClick={() => addAttendee(user)}
                                  className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 cursor-pointer transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                    <span className="text-xs font-bold text-white">{user.name?.charAt(0)}</span>
                                  </div>
                                  <div>
                                    <p className="text-sm text-white">{user.name}</p>
                                    <p className="text-xs text-gray-500">{user.email}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Added Attendees */}
                        {attendees.length > 0 && (
                          <div className="space-y-2">
                            {attendees.map(att => {
                              const avail = attendeeAvailability[att.email];
                              return (
                                <div 
                                  key={att.email}
                                  className="flex items-center justify-between p-2.5 bg-white/5 rounded-lg border border-white/5"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                                      <span className="text-[10px] font-bold text-white">{att.name?.charAt(0)}</span>
                                    </div>
                                    <div>
                                      <p className="text-sm text-gray-200">{att.name}</p>
                                      <p className="text-[10px] text-gray-500">{att.email}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {checkingAvailability ? (
                                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                                    ) : avail ? (
                                      <span className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${
                                        avail.status === 'free' 
                                          ? 'bg-green-500/20 text-green-400' 
                                          : avail.status === 'blocked'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-gray-500/20 text-gray-400'
                                      }`}>
                                        {avail.status === 'free' ? (
                                          <><UserCheck className="w-3 h-3" /> Free</>
                                        ) : avail.status === 'blocked' ? (
                                          <><UserX className="w-3 h-3" /> Busy</>
                                        ) : (
                                          <>Not found</>
                                        )}
                                      </span>
                                    ) : null}
                                    <button
                                      type="button"
                                      onClick={() => removeAttendee(att.email)}
                                      className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Scheduling Assistant */}
                        <AnimatePresence>
                          {showSchedulingAssistant && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-medium text-purple-300 flex items-center gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    Scheduling Assistant
                                  </h4>
                                  <select
                                    value={meetingDuration}
                                    onChange={(e) => setMeetingDuration(Number(e.target.value))}
                                    className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                                  >
                                    <option value={15}>15 min</option>
                                    <option value={30}>30 min</option>
                                    <option value={45}>45 min</option>
                                    <option value={60}>1 hour</option>
                                    <option value={90}>1.5 hours</option>
                                    <option value={120}>2 hours</option>
                                  </select>
                                </div>

                                <button
                                  type="button"
                                  onClick={findFreeSlots}
                                  disabled={loadingSlots}
                                  className="w-full py-2 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/30 rounded-lg text-sm text-purple-200 transition-colors flex items-center justify-center gap-2"
                                >
                                  {loadingSlots ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Finding Slots...</>
                                  ) : (
                                    <><Search className="w-4 h-4" /> Find Available Slots</>
                                  )}
                                </button>

                                {freeSlots.length > 0 && (
                                  <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
                                    {freeSlots.slice(0, 8).map((slot, i) => (
                                      <button
                                        key={i}
                                        type="button"
                                        onClick={() => selectTimeSlot(slot)}
                                        className="w-full flex items-center justify-between p-2.5 bg-white/5 hover:bg-white/10 rounded-lg text-left transition-colors group"
                                      >
                                        <span className="text-sm text-gray-200">
                                          {slot.startFormatted} - {slot.endFormatted}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-purple-400 transition-colors" />
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {freeSlots.length === 0 && !loadingSlots && (
                                  <p className="text-xs text-gray-500 text-center py-2">
                                    Click "Find Available Slots" to see times when everyone is free
                                  </p>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </>
                  )}

                  {/* Calendar Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-purple-400" /> Calendar
                    </label>
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                      value={effectiveCalendarId}
                      onChange={(e) => setCalendarId(e.target.value)}
                    >
                      {!effectiveCalendarId && <option value="" disabled>No editable calendars</option>}
                      {personalCalendar && <option value={personalCalendar._id} className="bg-gray-900">{personalCalendar.name} (Personal)</option>}
                      {editableCalendars.filter(cal => !personalCalendar || cal._id !== personalCalendar._id).map(cal => (
                        <option key={cal._id} value={cal._id} className="bg-gray-900">{cal.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Description */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <AlignLeft className="w-4 h-4 text-gray-400" /> Description
                    </label>
                    <textarea
                      rows={2}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none text-sm"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add details..."
                    />
                  </div>

                  {/* Error & Footer */}
                  {error && (
                    <div className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className={`px-6 py-2 text-white rounded-xl text-sm font-semibold shadow-lg transition-all hover:scale-105 active:scale-95 ${
                        isMeeting 
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/20 hover:shadow-purple-500/40'
                          : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/20 hover:shadow-blue-500/40'
                      }`}
                    >
                      {isMeeting ? 'Schedule Meeting' : 'Create Event'}
                    </button>
                  </div>
                </form>
              </div>
            </GlassPanel>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default EventModal;
