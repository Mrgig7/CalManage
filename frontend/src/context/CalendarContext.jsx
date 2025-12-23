import { createContext, useState, useEffect, useContext, useCallback, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext';

const CalendarContext = createContext();

// Cache duration in milliseconds (5 minutes)
const CACHE_DURATION = 5 * 60 * 1000;

export const CalendarProvider = ({ children }) => {
  const [calendars, setCalendars] = useState([]);
  const [sharedCalendars, setSharedCalendars] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState(new Set());
  // Initialize with all default categories to prevent race condition on first render
  const [selectedCategories, setSelectedCategories] = useState(new Set(['personal', 'business', 'academic', 'health', 'social', 'travel', 'finance']));
  const { token, user } = useAuth();

  // ========== CACHING SYSTEM ==========
  // Centralized event cache: { calendarId: { events: [], timestamp: Date } }
  const [eventCache, setEventCache] = useState({});
  const [allCachedEvents, setAllCachedEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const eventLoadPromiseRef = useRef(null);
  
  // Track if we've done the initial load to prevent re-triggering
  const initialLoadDoneRef = useRef(false);

  const calendarsRef = useRef(calendars);
  const sharedCalendarsRef = useRef(sharedCalendars);

  useEffect(() => {
    calendarsRef.current = calendars;
  }, [calendars]);

  useEffect(() => {
    sharedCalendarsRef.current = sharedCalendars;
  }, [sharedCalendars]);

  // Load visibility preferences from localStorage
  const loadVisibilityPreferences = useCallback(() => {
    if (!user || !user._id) return null;
    try {
      const raw = localStorage.getItem(`calendarVisibility:${user._id}`);
      return raw ? new Set(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, [user]);

  // Save visibility preferences to localStorage
  const saveVisibilityPreferences = useCallback((ids) => {
    if (!user || !user._id) return;
    try {
      localStorage.setItem(`calendarVisibility:${user._id}`, JSON.stringify([...ids]));
    } catch {
      // Ignore storage errors
    }
  }, [user]);

  // Load groups from localStorage (frontend-only for now, can be moved to backend later)
  const loadGroups = useCallback(() => {
    if (!user || !user._id) return [];
    try {
      const raw = localStorage.getItem(`calendarGroups:${user._id}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }, [user]);

  // Save groups to localStorage
  const saveGroups = useCallback((groupsData) => {
    if (!user || !user._id) return;
    try {
      localStorage.setItem(`calendarGroups:${user._id}`, JSON.stringify(groupsData));
    } catch {
      // Ignore storage errors
    }
  }, [user]);

  // Load category filter preferences from localStorage
  const loadCategoryPreferences = useCallback(() => {
    if (!user || !user._id) return null;
    try {
      const raw = localStorage.getItem(`categoryFilters:${user._id}`);
      return raw ? new Set(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }, [user]);

  // Save category filter preferences to localStorage
  const saveCategoryPreferences = useCallback((categories) => {
    if (!user || !user._id) return;
    try {
      localStorage.setItem(`categoryFilters:${user._id}`, JSON.stringify([...categories]));
    } catch {
      // Ignore storage errors
    }
  }, [user]);

  // Track if visibility has been initialized (expose as state for consumers)
  const [visibilityInitialized, setVisibilityInitialized] = useState(false);
  const visibilityInitializedRef = useRef(false);

  // Initialize visibility when calendars are loaded (only once)
  useEffect(() => {
    if ((calendars.length > 0 || sharedCalendars.length > 0) && !visibilityInitializedRef.current) {
      visibilityInitializedRef.current = true;
      setVisibilityInitialized(true);
      const savedVisibility = loadVisibilityPreferences();
      if (savedVisibility && savedVisibility.size > 0) {
        setVisibleCalendarIds(savedVisibility);
      } else {
        // Default: all calendars visible
        const allIds = new Set([
          ...calendars.map(c => c._id),
          ...sharedCalendars.map(c => c._id)
        ]);
        setVisibleCalendarIds(allIds);
      }
    }
  }, [calendars.length, sharedCalendars.length, calendars, sharedCalendars, loadVisibilityPreferences]);

  // Load groups on mount
  useEffect(() => {
    if (user) {
      setGroups(loadGroups());
      // Load category preferences
      const savedCategories = loadCategoryPreferences();
      if (savedCategories && savedCategories.size > 0) {
        setSelectedCategories(savedCategories);
      } else {
        // Default: all categories visible
        setSelectedCategories(new Set(['personal', 'business', 'academic', 'health', 'social', 'travel', 'finance']));
      }
    }
  }, [user, loadGroups, loadCategoryPreferences]);

  // Toggle calendar visibility
  const toggleCalendarVisibility = useCallback((calendarId) => {
    setVisibleCalendarIds(prev => {
      const next = new Set(prev);
      if (next.has(calendarId)) {
        next.delete(calendarId);
      } else {
        next.add(calendarId);
      }
      saveVisibilityPreferences(next);
      return next;
    });
  }, [saveVisibilityPreferences]);

  // Set multiple calendars visible/hidden (for groups)
  const setCalendarsVisible = useCallback((calendarIds, visible) => {
    setVisibleCalendarIds(prev => {
      const next = new Set(prev);
      for (const id of calendarIds) {
        if (visible) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      saveVisibilityPreferences(next);
      return next;
    });
  }, [saveVisibilityPreferences]);

  // Check if calendar is visible
  const isCalendarVisible = useCallback((calendarId) => {
    return visibleCalendarIds.has(calendarId);
  }, [visibleCalendarIds]);

  // Category filter functions
  const toggleCategoryFilter = useCallback((category) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      saveCategoryPreferences(next);
      return next;
    });
  }, [saveCategoryPreferences]);

  // Check if category is selected
  const isCategorySelected = useCallback((category) => {
    return selectedCategories.has(category);
  }, [selectedCategories]);

  // Select all categories
  const selectAllCategories = useCallback(() => {
    const all = new Set(['personal', 'business', 'academic', 'health', 'social', 'travel', 'finance']);
    setSelectedCategories(all);
    saveCategoryPreferences(all);
  }, [saveCategoryPreferences]);

  // Clear all categories
  const clearAllCategories = useCallback(() => {
    setSelectedCategories(new Set());
    saveCategoryPreferences(new Set());
  }, [saveCategoryPreferences]);

  // Group management functions
  const addGroup = useCallback((groupData) => {
    const newGroup = {
      id: Date.now().toString(),
      name: groupData.name,
      color: groupData.color || '#8b5cf6',
      calendarIds: groupData.calendarIds || [],
      createdAt: new Date().toISOString()
    };
    const updatedGroups = [...groups, newGroup];
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
    return newGroup;
  }, [groups, saveGroups]);

  const updateGroup = useCallback((groupId, updates) => {
    const updatedGroups = groups.map(g => 
      g.id === groupId ? { ...g, ...updates } : g
    );
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  }, [groups, saveGroups]);

  const deleteGroup = useCallback((groupId) => {
    const updatedGroups = groups.filter(g => g.id !== groupId);
    setGroups(updatedGroups);
    saveGroups(updatedGroups);
  }, [groups, saveGroups]);

  // Toggle all calendars in a group
  const toggleGroupVisibility = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group) return;
    
    // Check if all calendars in group are currently visible
    const allVisible = group.calendarIds.every(id => visibleCalendarIds.has(id));
    
    // If all visible, hide all. Otherwise, show all.
    setCalendarsVisible(group.calendarIds, !allVisible);
  }, [groups, visibleCalendarIds, setCalendarsVisible]);

  // Check if all calendars in a group are visible
  const isGroupVisible = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || group.calendarIds.length === 0) return false;
    return group.calendarIds.every(id => visibleCalendarIds.has(id));
  }, [groups, visibleCalendarIds]);

  // Check if some (but not all) calendars in a group are visible
  const isGroupPartiallyVisible = useCallback((groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || group.calendarIds.length === 0) return false;
    const visibleCount = group.calendarIds.filter(id => visibleCalendarIds.has(id)).length;
    return visibleCount > 0 && visibleCount < group.calendarIds.length;
  }, [groups, visibleCalendarIds]);

  const loadColorPreferences = useCallback(() => {
    if (!user || !user._id) return {};
    try {
      const raw = localStorage.getItem(`calendarColors:${user._id}`);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, [user]);

  const saveColorPreferences = useCallback((prefs) => {
    if (!user || !user._id) return;
    try {
      localStorage.setItem(`calendarColors:${user._id}`, JSON.stringify(prefs));
    } catch (e) {
      const _ = e;
      return;
    }
  }, [user]);

  const hslToHex = useCallback((h, s, l) => {
    const sNorm = s / 100;
    const lNorm = l / 100;
    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = lNorm - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;
    if (h >= 0 && h < 60) {
      r = c;
      g = x;
    } else if (h >= 60 && h < 120) {
      r = x;
      g = c;
    } else if (h >= 120 && h < 180) {
      g = c;
      b = x;
    } else if (h >= 180 && h < 240) {
      g = x;
      b = c;
    } else if (h >= 240 && h < 300) {
      r = x;
      b = c;
    } else {
      r = c;
      b = x;
    }
    const toHex = (v) => {
      const hex = Math.round((v + m) * 255).toString(16).padStart(2, '0');
      return hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }, []);

  const assignColors = useCallback((own, shared) => {
    if (!user || !user._id) {
      return { calendars: own, sharedCalendars: shared };
    }
    const prefs = loadColorPreferences();
    const all = [...own, ...shared];
    const used = new Set(Object.values(prefs));
    let index = all.length;
    for (const cal of all) {
      if (!prefs[cal._id]) {
        let color = '';
        let attempts = 0;
        while (attempts < 720) {
          const hue = (index * 137.508) % 360;
          const candidate = hslToHex(hue, 65, 55);
          index += 1;
          attempts += 1;
          if (!used.has(candidate)) {
            color = candidate;
            used.add(candidate);
            break;
          }
        }
        if (!color) {
          color = '#3b82f6';
        }
        prefs[cal._id] = color;
      }
    }
    saveColorPreferences(prefs);
    const mapWithColor = (cal) => ({
      ...cal,
      color: prefs[cal._id] || cal.color || '#3b82f6',
    });
    return {
      calendars: own.map(mapWithColor),
      sharedCalendars: shared.map(mapWithColor),
    };
  }, [hslToHex, loadColorPreferences, saveColorPreferences, user]);

  const fetchCalendars = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:5000/api/calendars', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        const sorted = [...data].sort((a, b) => {
          if (a.isDefault === b.isDefault) {
            return new Date(a.createdAt) - new Date(b.createdAt);
          }
          return a.isDefault ? -1 : 1;
        });
        const colored = assignColors(sorted, sharedCalendarsRef.current);
        setCalendars(colored.calendars);
        setSharedCalendars(colored.sharedCalendars);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [assignColors, token]);

  const addCalendar = async (calendarData) => {
    try {
      const res = await fetch('http://localhost:5000/api/calendars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(calendarData),
      });
      const data = await res.json();
      if (res.ok) {
        const nextOwn = [...calendars, data];
        const colored = assignColors(nextOwn, sharedCalendarsRef.current);
        setCalendars(colored.calendars);
        setSharedCalendars(colored.sharedCalendars);
        // Auto-show new calendar
        setVisibleCalendarIds(prev => {
          const next = new Set(prev);
          next.add(data._id);
          saveVisibilityPreferences(next);
          return next;
        });
        return colored.calendars.find(c => c._id === data._id) || data;
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Delete a calendar and all its related data
  const deleteCalendar = async (calendarId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/calendars/${calendarId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok) {
        // Remove calendar from state
        setCalendars(prev => prev.filter(c => c._id !== calendarId));
        
        // Remove from visibility set
        setVisibleCalendarIds(prev => {
          const next = new Set(prev);
          next.delete(calendarId);
          saveVisibilityPreferences(next);
          return next;
        });
        
        // Remove cached events for this calendar
        setAllCachedEvents(prev => prev.filter(e => e.calendarId !== calendarId));
        setEventCache(prev => {
          const next = { ...prev };
          delete next[calendarId];
          return next;
        });
        
        return { success: true, message: data.message };
      }
      return { success: false, error: data.message || 'Failed to delete calendar' };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'Failed to delete calendar' };
    }
  };

  // Optimized: Fetch single calendar events with caching
  const fetchCalendarEvents = useCallback(async (calendarId, forceRefresh = false) => {
    // Check cache first (if not forcing refresh)
    if (!forceRefresh && eventCache[calendarId]) {
      const { events: cachedEvents, timestamp } = eventCache[calendarId];
      const isStale = Date.now() - timestamp > CACHE_DURATION;
      
      // Return cached immediately (stale-while-revalidate)
      if (!isStale) {
        return cachedEvents;
      }
    }

    try {
      const res = await fetch(`http://localhost:5000/api/calendars/${calendarId}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        // Update cache
        setEventCache(prev => ({
          ...prev,
          [calendarId]: { events: data, timestamp: Date.now() }
        }));
        return data;
      }
      return eventCache[calendarId]?.events || [];
    } catch (error) {
      console.error(error);
      return eventCache[calendarId]?.events || [];
    }
  }, [token, eventCache]);

  // Refs to track loading state without causing re-renders
  const eventsLoadedRef = useRef(false);
  const allCachedEventsRef = useRef([]);

  // Keep refs in sync with state
  useEffect(() => {
    eventsLoadedRef.current = eventsLoaded;
  }, [eventsLoaded]);

  useEffect(() => {
    allCachedEventsRef.current = allCachedEvents;
  }, [allCachedEvents]);

  // Optimized: Load ALL events for ALL calendars in parallel with caching
  // Optional calendarsList and sharedCalendarsList parameters to avoid race condition with refs
  const loadAllEvents = useCallback(async (forceRefresh = false, calendarsList = null, sharedCalendarsList = null) => {
    // If already loading, return the existing promise
    if (eventLoadPromiseRef.current && !forceRefresh) {
      return eventLoadPromiseRef.current;
    }

    // If already loaded and not forcing refresh, return cached (use ref to avoid dependency)
    if (eventsLoadedRef.current && !forceRefresh && allCachedEventsRef.current.length > 0) {
      return allCachedEventsRef.current;
    }

    setEventsLoading(true);

    const loadPromise = (async () => {
      // Use provided calendars or fall back to refs
      const ownCals = calendarsList || calendarsRef.current;
      const sharedCals = sharedCalendarsList || sharedCalendarsRef.current || [];
      const allCals = [...ownCals, ...sharedCals];
      
      if (allCals.length === 0) {
        setEventsLoading(false);
        setEventsLoaded(true);
        return [];
      }

      try {
        // Parallel fetch for ALL calendars at once
        const eventPromises = allCals.map(async (cal) => {
          try {
            const res = await fetch(`http://localhost:5000/api/calendars/${cal._id}/events`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
              return {
                calendarId: cal._id,
                events: data.map(ev => ({
                  ...ev,
                  color: cal.color,
                  calendarName: cal.name,
                  calendarId: cal._id,
                  isShared: cal.isShared || false,
                  ownerName: cal.owner?.name
                }))
              };
            }
            return { calendarId: cal._id, events: [] };
          } catch {
            return { calendarId: cal._id, events: [] };
          }
        });

        const results = await Promise.all(eventPromises);

        // Update cache for each calendar
        const newCache = {};
        let allEvents = [];
        
        for (const result of results) {
          newCache[result.calendarId] = { 
            events: result.events, 
            timestamp: Date.now() 
          };
          allEvents = [...allEvents, ...result.events];
        }

        setEventCache(prev => ({ ...prev, ...newCache }));
        setAllCachedEvents(allEvents);
        setEventsLoaded(true);
        setEventsLoading(false);
        eventLoadPromiseRef.current = null;
        
        return allEvents;
      } catch (error) {
        console.error('Error loading all events:', error);
        setEventsLoading(false);
        eventLoadPromiseRef.current = null;
        return allCachedEventsRef.current;
      }
    })();

    eventLoadPromiseRef.current = loadPromise;
    return loadPromise;
  }, [token]); // Only depends on token now - no more circular dependency

  // Auto-load events when calendars change (only once per session, not on every calendar change)
  useEffect(() => {
    if ((calendars.length > 0 || sharedCalendars.length > 0) && !initialLoadDoneRef.current) {
      initialLoadDoneRef.current = true;
      // Pass calendars directly to avoid race condition with refs
      loadAllEvents(false, calendars, sharedCalendars);
    }
  }, [calendars, sharedCalendars, loadAllEvents]);

  // Legacy fetchEvents for backward compatibility
  const fetchEvents = async (calendarId) => {
    const events = await fetchCalendarEvents(calendarId);
    setEvents(events);
  };

  const addEvent = async (calendarId, eventData) => {
    try {
      const res = await fetch(`http://localhost:5000/api/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventData),
      });
      const data = await res.json();
      if (res.ok) {
        // Find the calendar to get color and name
        const cal = [...calendarsRef.current, ...sharedCalendarsRef.current].find(c => c._id === calendarId);
        const enrichedEvent = {
          ...data,
          color: cal?.color,
          calendarName: cal?.name,
          calendarId: calendarId,
          isShared: cal?.isShared || false,
          ownerName: cal?.owner?.name
        };
        
        // Update legacy events state
        setEvents(prev => [...prev, data]);
        
        // Update cache immediately
        setAllCachedEvents(prev => [...prev, enrichedEvent]);
        setEventCache(prev => ({
          ...prev,
          [calendarId]: {
            events: [...(prev[calendarId]?.events || []), enrichedEvent],
            timestamp: Date.now()
          }
        }));
        
        return { success: true, event: enrichedEvent };
      }
      return { success: false, error: data.message || 'Failed to create event' };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'Failed to create event' };
    }
  };

  const deleteEvent = async (calendarId, eventId) => {
    try {
      const res = await fetch(`http://localhost:5000/api/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        // Update legacy events state
        setEvents(prev => prev.filter(e => e._id !== eventId));
        
        // Update cache immediately
        setAllCachedEvents(prev => prev.filter(e => e._id !== eventId));
        setEventCache(prev => ({
          ...prev,
          [calendarId]: {
            events: (prev[calendarId]?.events || []).filter(e => e._id !== eventId),
            timestamp: Date.now()
          }
        }));
        
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.message || 'Failed to delete event' };
    } catch (error) {
      console.error(error);
      return { success: false, error: 'Failed to delete event' };
    }
  };

  const fetchSharedCalendars = useCallback(async () => {
      try {
          const res = await fetch('http://localhost:5000/api/shares', {
              headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          console.log('[CalendarContext] Fetched shares response:', data);
          if (res.ok) {
              // Filter out any shares where calendar is null (e.g., deleted calendars)
              const validShares = data.filter(share => share && share.calendar);
              console.log('[CalendarContext] Valid shares after filtering:', validShares);
              const shared = validShares.map(share => ({
                  ...share.calendar,
                  _id: share.calendar._id,
                  role: share.role,
                  owner: share.calendar.user,
                  isShared: true,
              }));
              console.log('[CalendarContext] Mapped shared calendars:', shared);
              const colored = assignColors(calendarsRef.current, shared);
              setCalendars(colored.calendars);
              setSharedCalendars(colored.sharedCalendars);
              return colored.sharedCalendars;
          }
          setSharedCalendars([]);
          return [];
      } catch (error) {
          console.error('[CalendarContext] Error fetching shared calendars:', error);
          setSharedCalendars([]);
          return [];
      }
  }, [assignColors, token]);

  useEffect(() => {
    if (token) {
      fetchCalendars();
      fetchSharedCalendars();
    }
  }, [token, fetchCalendars, fetchSharedCalendars]);

  const shareCalendar = async (calendarId, email, role) => {
      try {
          const res = await fetch('http://localhost:5000/api/shares', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ calendarId, email, role })
          });
          return await res.json();
      } catch (error) {
          console.error(error);
          throw error;
      }
  };

  // Memoized context value for performance
  const contextValue = useMemo(() => ({
    calendars,
    sharedCalendars,
    events,
    loading,
    groups,
    visibleCalendarIds,
    selectedCategories,
    // Caching system
    allCachedEvents,
    eventsLoading,
    eventsLoaded,
    loadAllEvents,
    // Calendar CRUD
    addCalendar,
    deleteCalendar,
    fetchCalendars,
    fetchEvents,
    fetchCalendarEvents,
    addEvent,
    deleteEvent,
    fetchSharedCalendars,
    shareCalendar,
    // Visibility
    toggleCalendarVisibility,
    setCalendarsVisible,
    isCalendarVisible,
    // Category filters
    toggleCategoryFilter,
    isCategorySelected,
    selectAllCategories,
    clearAllCategories,
    // Groups
    addGroup,
    updateGroup,
    deleteGroup,
    toggleGroupVisibility,
    isGroupVisible,
    isGroupPartiallyVisible,
    visibilityInitialized,
  }), [
    calendars, sharedCalendars, events, loading, groups, visibleCalendarIds, selectedCategories,
    allCachedEvents, eventsLoading, eventsLoaded, loadAllEvents, visibilityInitialized,
    fetchCalendars, fetchCalendarEvents, fetchSharedCalendars, deleteCalendar,
    toggleCalendarVisibility, setCalendarsVisible, isCalendarVisible,
    toggleCategoryFilter, isCategorySelected, selectAllCategories, clearAllCategories,
    addGroup, updateGroup, deleteGroup, toggleGroupVisibility, isGroupVisible, isGroupPartiallyVisible
  ]);

  return (
    <CalendarContext.Provider value={contextValue}>
      {children}
    </CalendarContext.Provider>
  );
};

export const useCalendar = () => useContext(CalendarContext);
