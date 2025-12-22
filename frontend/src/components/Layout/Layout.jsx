import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCalendar } from '../../context/CalendarContext';
import { 
  LogOut, 
  Calendar as CalendarIcon, 
  Settings, 
  Plus, 
  LayoutDashboard, 
  CheckSquare, 
  Search, 
  Bell,
  Users,
  X,
  Trash2,
  Menu,
  Folder,
  ChevronDown,
  ChevronRight,
  Edit3,
  Loader2,
  Clock,
  FileText,
  Tag,
  User,
  Briefcase,
  GraduationCap,
  Heart,
  Plane,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CalendarModal from '../Modals/CalendarModal';
import ShareCalendarModal from '../Modals/ShareCalendarModal';
import EventModal from '../Modals/EventModal';
import ThreeBackground from '../ThreeBackground';
import GlassPanel from '../UI/GlassPanel';

const Layout = () => {
  const { user, logout, token } = useAuth();
  const { 
    calendars, 
    sharedCalendars, 
    groups,
    toggleCalendarVisibility, 
    isCalendarVisible,
    addGroup,
    deleteGroup,
    toggleGroupVisibility,
    isGroupVisible,
    isGroupPartiallyVisible,
    toggleCategoryFilter,
    isCategorySelected
  } = useCalendar();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [eventSelectedDate, setEventSelectedDate] = useState(new Date());

  // Share Modal State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [calendarToShare, setCalendarToShare] = useState(null);

  // Notifications state
  const [notifications, setNotifications] = useState([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Mobile toggle

  // Group Modal State
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [selectedCalendarsForGroup, setSelectedCalendarsForGroup] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ events: [], calendars: [], tasks: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(-1);
  const [searchCategoryFilter, setSearchCategoryFilter] = useState('');
  const searchRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  // Search function with debounce
  const performSearch = useCallback(async (query, categoryFilter = '') => {
    if (!query || query.length < 2) {
      setSearchResults({ events: [], calendars: [], tasks: [] });
      setIsSearchOpen(false);
      return;
    }

    setIsSearching(true);
    try {
      let url = `http://localhost:5000/api/search?q=${encodeURIComponent(query)}`;
      if (categoryFilter) {
        url += `&category=${encodeURIComponent(categoryFilter)}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setIsSearchOpen(true);
        setSelectedSearchIndex(-1);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsSearching(false);
    }
  }, [token]);

  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Debounce search
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query, searchCategoryFilter);
    }, 300);
  };

  const handleCategoryFilterChange = (category) => {
    setSearchCategoryFilter(category);
    if (searchQuery.length >= 2) {
      performSearch(searchQuery, category);
    }
  };

  const handleSearchKeyDown = (e) => {
    const allResults = [
      ...searchResults.events.map(r => ({ ...r, type: 'event' })),
      ...searchResults.calendars.map(r => ({ ...r, type: 'calendar' })),
      ...searchResults.tasks.map(r => ({ ...r, type: 'task' }))
    ];

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.min(prev + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedSearchIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && selectedSearchIndex >= 0) {
      e.preventDefault();
      handleSearchResultClick(allResults[selectedSearchIndex]);
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const handleSearchResultClick = (result) => {
    setIsSearchOpen(false);
    setSearchQuery('');

    if (result.type === 'event') {
      // Navigate to calendar with the event's date
      const eventDate = new Date(result.start);
      navigate('/calendar', { state: { selectedDate: eventDate } });
    } else if (result.type === 'calendar') {
      navigate('/calendar');
    } else if (result.type === 'task') {
      navigate('/tasks');
    }
  };

  // Close search dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ... (Keep existing notification logic unchanged) ...
  const getNotifications = useCallback(async (authToken) => {
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (res.ok) {
        return data;
      }
    } catch (error) {
      console.error('Failed to fetch notifications', error);
    }
    return [];
  }, []);

  const applyNotifications = useCallback((data) => {
    setNotifications(data);
    setUnreadCount(data.filter(n => !n.isRead).length);
  }, []);

  useEffect(() => {
    if (token) {
      let cancelled = false;
      const poll = async () => {
        const data = await getNotifications(token);
        if (!cancelled) applyNotifications(data);
      };
      poll();
      const interval = setInterval(poll, 60000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
  }, [token, getNotifications, applyNotifications]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications(notifications.map(n => n._id === id ? { ...n, isRead: true } : n));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) { console.error(error); }
  };

  const clearNotifications = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/notifications', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } catch (error) { console.error(error); }
  };

  const deleteNotification = async (id) => {
    try {
      const res = await fetch(`http://localhost:5000/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const removed = notifications.find(n => n._id === id);
        setNotifications(notifications.filter(n => n._id !== id));
        if (removed && !removed.isRead) setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) { console.error(error); }
  };

  const NavItem = ({ to, icon: Icon, children }) => (
    <Link to={to}>
      <motion.div 
        className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${
          isActive(to) 
            ? 'bg-blue-600/20 text-blue-400 shadow-lg shadow-blue-500/10 border border-blue-500/30' 
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
        }`}
        whileHover={{ scale: 1.02, x: 4 }}
        whileTap={{ scale: 0.98 }}
      >
        <Icon className="w-5 h-5 mr-3" />
        {children}
      </motion.div>
    </Link>
  );

  return (
    <div className="relative flex h-screen overflow-hidden bg-dark-bg text-white font-sans">
      {/* Global 3D Background */}
      <ThreeBackground />

      {/* Mobile Toggle */}
      <div className="lg:hidden absolute top-4 left-4 z-50">
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 bg-glass-surface rounded-lg text-white">
            <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside 
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className="w-72 h-full p-4 flex-shrink-0 z-40 lg:relative absolute"
          >
            <GlassPanel className="h-full flex flex-col backdrop-blur-2xl bg-black/40 border-white/5">
              <div className="p-6 flex items-center space-x-3 border-b border-white/5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <CalendarIcon className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                  CalManage
                </span>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
                <div className="mb-8">
                  <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-2">Overview</h3>
                  <nav className="space-y-2">
                    <NavItem to="/" icon={LayoutDashboard}>Dashboard</NavItem>
                    <NavItem to="/calendar" icon={CalendarIcon}>Calendar</NavItem>
                    <NavItem to="/tasks" icon={CheckSquare}>Tasks</NavItem>
                  </nav>
                </div>

                {/* EVENT CATEGORIES Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-[10px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      Event Categories
                    </h3>
                  </div>
                  <nav className="space-y-1">
                    {[
                      { id: 'personal', label: 'Personal', icon: User, color: '#3b82f6' },
                      { id: 'business', label: 'Business', icon: Briefcase, color: '#6366f1' },
                      { id: 'academic', label: 'Academic', icon: GraduationCap, color: '#8b5cf6' },
                      { id: 'health', label: 'Health', icon: Heart, color: '#f43f5e' },
                      { id: 'social', label: 'Social', icon: Users, color: '#f59e0b' },
                      { id: 'travel', label: 'Travel', icon: Plane, color: '#06b6d4' },
                      { id: 'finance', label: 'Finance', icon: DollarSign, color: '#10b981' },
                    ].map((cat) => {
                      const Icon = cat.icon;
                      const isSelected = isCategorySelected(cat.id);
                      return (
                        <motion.div
                          key={cat.id}
                          whileHover={{ x: 4 }}
                          onClick={() => toggleCategoryFilter(cat.id)}
                          className={`flex items-center px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/5 cursor-pointer group transition-all ${
                            isSelected ? 'text-gray-300' : 'text-gray-600'
                          }`}
                        >
                          <div
                            className={`w-3 h-3 rounded-sm mr-3 border-2 flex items-center justify-center transition-all ${
                              isSelected ? 'border-transparent' : 'border-gray-600'
                            }`}
                            style={{ backgroundColor: isSelected ? cat.color : 'transparent' }}
                          >
                            {isSelected && (
                              <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                          <Icon className="w-3.5 h-3.5 mr-2" style={{ color: isSelected ? cat.color : 'inherit' }} />
                          <span className={`truncate transition-colors ${isSelected ? 'group-hover:text-white' : ''}`}>
                            {cat.label}
                          </span>
                        </motion.div>
                      );
                    })}
                  </nav>
                </div>

                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">My Calendars</h3>
                    <motion.button 
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      onClick={() => setIsCalendarModalOpen(true)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>
                  <nav className="space-y-1">
                    {calendars.map((cal) => (
                      <motion.div 
                        key={cal._id} 
                        whileHover={{ x: 4 }}
                        className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/5 cursor-pointer group transition-all ${
                          isCalendarVisible(cal._id) ? 'text-gray-300' : 'text-gray-600'
                        }`}
                      >
                        <div className="flex items-center" onClick={() => toggleCalendarVisibility(cal._id)}>
                            <div 
                              className={`w-3 h-3 rounded-sm mr-3 border-2 flex items-center justify-center transition-all ${
                                isCalendarVisible(cal._id) ? 'border-transparent' : 'border-gray-600'
                              }`}
                              style={{ backgroundColor: isCalendarVisible(cal._id) ? cal.color : 'transparent' }}
                            >
                              {isCalendarVisible(cal._id) && (
                                <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                            <span className={`truncate transition-colors ${isCalendarVisible(cal._id) ? 'group-hover:text-white' : ''}`}>
                              {cal.name}
                            </span>
                        </div>
                        {!cal.isDefault && <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              setCalendarToShare(cal);
                              setIsShareModalOpen(true);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-blue-400 p-1 transition-all"
                        >
                          <Users className="w-3 h-3" />
                        </button>}
                      </motion.div>
                    ))}
                  </nav>
                </div>

                {/* SHARED CALENDARS Section */}
                {sharedCalendars && sharedCalendars.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2 px-2">
                      <h3 className="text-[10px] font-bold text-purple-400 uppercase tracking-widest flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Shared
                      </h3>
                    </div>
                    <nav className="space-y-1">
                      {sharedCalendars.map((cal) => (
                        <motion.div 
                          key={cal._id} 
                          whileHover={{ x: 4 }}
                          onClick={() => toggleCalendarVisibility(cal._id)}
                          className={`flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg hover:bg-white/5 cursor-pointer group transition-all ${
                            isCalendarVisible(cal._id) ? 'text-gray-300' : 'text-gray-600'
                          }`}
                        >
                          <div className="flex items-center flex-1 min-w-0">
                              <div 
                                className={`w-3 h-3 rounded-sm mr-3 border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                                  isCalendarVisible(cal._id) ? 'border-transparent' : 'border-gray-600'
                                }`}
                                style={{ backgroundColor: isCalendarVisible(cal._id) ? cal.color : 'transparent' }}
                              >
                                {isCalendarVisible(cal._id) && (
                                  <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className={`truncate transition-colors ${isCalendarVisible(cal._id) ? 'group-hover:text-white' : ''}`}>
                                  {cal.name}
                                </span>
                                <span className="text-[10px] text-gray-500 truncate">
                                  by {cal.owner?.name || 'Unknown'}
                                </span>
                              </div>
                          </div>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                            cal.role === 'editor' 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-blue-500/20 text-blue-400'
                          }`}>
                            {cal.role === 'editor' ? 'Edit' : 'View'}
                          </span>
                        </motion.div>
                      ))}
                    </nav>
                  </div>
                )}

                {/* GROUPS Section */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <h3 className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      Groups
                    </h3>
                    <motion.button 
                      whileHover={{ scale: 1.1 }}
                      onClick={() => setIsGroupModalOpen(true)}
                      className="text-gray-500 hover:text-amber-400 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </motion.button>
                  </div>
                  
                  {groups && groups.length > 0 ? (
                    <nav className="space-y-1">
                      {groups.map((group) => {
                        const isExpanded = expandedGroups.has(group.id);
                        const allVisible = isGroupVisible(group.id);
                        const partiallyVisible = isGroupPartiallyVisible(group.id);
                        const allCalendars = [...calendars, ...sharedCalendars];
                        const groupCalendars = allCalendars.filter(c => group.calendarIds.includes(c._id));
                        
                        return (
                          <div key={group.id}>
                            <motion.div 
                              whileHover={{ x: 4 }}
                              className="flex items-center justify-between px-3 py-2 text-sm font-medium text-gray-400 rounded-lg hover:bg-white/5 cursor-pointer group transition-colors"
                            >
                              <div className="flex items-center flex-1 min-w-0">
                                <button 
                                  onClick={() => setExpandedGroups(prev => {
                                    const next = new Set(prev);
                                    if (next.has(group.id)) next.delete(group.id);
                                    else next.add(group.id);
                                    return next;
                                  })}
                                  className="mr-1 text-gray-500 hover:text-white"
                                >
                                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                <div 
                                  onClick={() => toggleGroupVisibility(group.id)}
                                  className={`w-3 h-3 rounded-sm mr-2 border-2 flex items-center justify-center transition-all ${
                                    allVisible ? 'border-transparent' : partiallyVisible ? 'border-transparent' : 'border-gray-600'
                                  }`}
                                  style={{ backgroundColor: allVisible ? group.color : partiallyVisible ? `${group.color}80` : 'transparent' }}
                                >
                                  {allVisible && (
                                    <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                  {partiallyVisible && !allVisible && (
                                    <div className="w-1.5 h-0.5 bg-white rounded" />
                                  )}
                                </div>
                                <span className="truncate group-hover:text-gray-200 transition-colors" onClick={() => toggleGroupVisibility(group.id)}>
                                  {group.name}
                                </span>
                                <span className="ml-2 text-[9px] text-gray-500">({groupCalendars.length})</span>
                              </div>
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteGroup(group.id); }}
                                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 p-1 transition-all"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </motion.div>
                            
                            {/* Expanded group calendars */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="ml-6 overflow-hidden"
                                >
                                  {groupCalendars.map(cal => (
                                    <div 
                                      key={cal._id}
                                      onClick={() => toggleCalendarVisibility(cal._id)}
                                      className={`flex items-center px-2 py-1.5 text-xs cursor-pointer hover:bg-white/5 rounded transition-colors ${
                                        isCalendarVisible(cal._id) ? 'text-gray-400' : 'text-gray-600'
                                      }`}
                                    >
                                      <div 
                                        className="w-2 h-2 rounded-sm mr-2"
                                        style={{ backgroundColor: isCalendarVisible(cal._id) ? cal.color : 'transparent', border: isCalendarVisible(cal._id) ? 'none' : '1px solid #666' }}
                                      />
                                      <span className="truncate">{cal.name}</span>
                                    </div>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </nav>
                  ) : (
                    <p className="text-[10px] text-gray-600 px-3 italic">No groups yet</p>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-white/5">
                <NavItem to="/settings" icon={Settings}>Settings</NavItem>
                <div className="flex items-center pt-4 mt-2">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5">
                      <div className="w-full h-full rounded-full bg-black/50 flex items-center justify-center overflow-hidden">
                        <span className="font-bold text-sm">{user?.name?.charAt(0)}</span>
                      </div>
                   </div>
                   <div className="ml-3 overflow-hidden">
                      <p className="text-sm font-medium text-white truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                   </div>
                   <button onClick={handleLogout} className="ml-auto text-gray-500 hover:text-red-400 transition-colors">
                     <LogOut className="w-4 h-4" />
                   </button>
                </div>
              </div>
            </GlassPanel>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <header className="px-8 py-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-indigo-200 to-indigo-400">
               {location.pathname === '/' ? 'Dashboard' : 
                location.pathname === '/calendar' ? 'Calendar' :
                location.pathname === '/tasks' ? 'Tasks' : 'Settings'}
            </h1>
            <p className="text-sm text-indigo-200/60 mt-1">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Search Bar */}
            <div className="relative group hidden md:block" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                {isSearching ? (
                  <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                ) : (
                  <Search className="h-4 w-4 text-indigo-300/50 group-focus-within:text-indigo-400 transition-colors" />
                )}
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => searchQuery.length >= 2 && setIsSearchOpen(true)}
                className="block w-64 pl-10 pr-3 py-2.5 border border-indigo-500/20 rounded-xl bg-white/5 text-white placeholder-indigo-300/30 focus:outline-none focus:bg-white/10 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all text-sm backdrop-blur-sm"
                placeholder="Search events, calendars..."
              />

              {/* Search Results Dropdown */}
              <AnimatePresence>
                {isSearchOpen && (searchResults.events.length > 0 || searchResults.calendars.length > 0 || searchResults.tasks.length > 0) && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 mt-2 z-50"
                  >
                    <GlassPanel className="p-0 overflow-hidden bg-black/90 border-white/10 max-h-96 overflow-y-auto">
                      {(() => {
                        let globalIndex = -1;
                        return (
                          <>
                            {/* Events Section */}
                            {searchResults.events.length > 0 && (
                              <div className="border-b border-white/5">
                                <div className="px-3 py-2 text-[10px] font-bold text-indigo-400 uppercase tracking-wider bg-white/5 flex items-center gap-2">
                                  <CalendarIcon className="w-3 h-3" />
                                  Events
                                </div>
                                {searchResults.events.map((event) => {
                                  globalIndex++;
                                  const idx = globalIndex;
                                  return (
                                    <div
                                      key={event._id}
                                      onClick={() => handleSearchResultClick({ ...event, type: 'event' })}
                                      className={`px-4 py-3 cursor-pointer transition-colors flex items-start gap-3 ${
                                        selectedSearchIndex === idx ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                                      }`}
                                    >
                                      <div
                                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                                        style={{ backgroundColor: event.calendarColor || '#3b82f6' }}
                                      />
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm text-white font-medium truncate">{event.title}</p>
                                          {event.category && (() => {
                                            const categoryInfo = {
                                              personal: { color: '#3b82f6', label: 'Personal' },
                                              business: { color: '#6366f1', label: 'Business' },
                                              academic: { color: '#8b5cf6', label: 'Academic' },
                                              health: { color: '#f43f5e', label: 'Health' },
                                              social: { color: '#f59e0b', label: 'Social' },
                                              travel: { color: '#06b6d4', label: 'Travel' },
                                              finance: { color: '#10b981', label: 'Finance' },
                                            }[event.category];
                                            return categoryInfo ? (
                                              <span 
                                                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                                                style={{ 
                                                  backgroundColor: `${categoryInfo.color}20`,
                                                  color: categoryInfo.color
                                                }}
                                              >
                                                {categoryInfo.label}
                                              </span>
                                            ) : null;
                                          })()}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                          <Clock className="w-3 h-3 text-gray-500" />
                                          <span className="text-[11px] text-gray-400">
                                            {new Date(event.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                          </span>
                                          {event.calendarName && (
                                            <span className="text-[10px] text-gray-500">• {event.calendarName}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Calendars Section */}
                            {searchResults.calendars.length > 0 && (
                              <div className="border-b border-white/5">
                                <div className="px-3 py-2 text-[10px] font-bold text-green-400 uppercase tracking-wider bg-white/5 flex items-center gap-2">
                                  <Folder className="w-3 h-3" />
                                  Calendars
                                </div>
                                {searchResults.calendars.map((cal) => {
                                  const isVisible = isCalendarVisible(cal._id);
                                  return (
                                    <div
                                      key={cal._id}
                                      onClick={() => toggleCalendarVisibility(cal._id)}
                                      className="px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 hover:bg-white/5"
                                    >
                                      <div
                                        className={`w-3 h-3 rounded-sm flex items-center justify-center transition-all ${
                                          isVisible ? 'border-transparent' : 'border-2 border-gray-600'
                                        }`}
                                        style={{ backgroundColor: isVisible ? cal.color || '#3b82f6' : 'transparent' }}
                                      >
                                        {isVisible && (
                                          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className={`text-sm ${isVisible ? 'text-white' : 'text-gray-500'}`}>{cal.name}</span>
                                      {cal.isShared && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400">Shared</span>
                                      )}
                                      <span 
                                        className="text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
                                        style={{ 
                                          backgroundColor: isVisible ? `${cal.color || '#3b82f6'}20` : 'rgba(255,255,255,0.05)',
                                          color: isVisible ? cal.color || '#3b82f6' : '#6b7280'
                                        }}
                                      >
                                        {isVisible ? 'Visible' : 'Hidden'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Categories Section - Show matching categories */}
                            {(() => {
                              const allCategories = [
                                { id: 'personal', label: 'Personal', icon: User, color: '#3b82f6' },
                                { id: 'business', label: 'Business', icon: Briefcase, color: '#6366f1' },
                                { id: 'academic', label: 'Academic', icon: GraduationCap, color: '#8b5cf6' },
                                { id: 'health', label: 'Health', icon: Heart, color: '#f43f5e' },
                                { id: 'social', label: 'Social', icon: Users, color: '#f59e0b' },
                                { id: 'travel', label: 'Travel', icon: Plane, color: '#06b6d4' },
                                { id: 'finance', label: 'Finance', icon: DollarSign, color: '#10b981' },
                              ];
                              const matchingCategories = allCategories.filter(cat => 
                                cat.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                cat.id.toLowerCase().includes(searchQuery.toLowerCase())
                              );
                              
                              if (matchingCategories.length === 0) return null;
                              
                              return (
                                <div className="border-b border-white/5">
                                  <div className="px-3 py-2 text-[10px] font-bold text-teal-400 uppercase tracking-wider bg-white/5 flex items-center gap-2">
                                    <Tag className="w-3 h-3" />
                                    Categories
                                  </div>
                                  {matchingCategories.map((cat) => {
                                    const Icon = cat.icon;
                                    const isSelected = isCategorySelected(cat.id);
                                    return (
                                      <div
                                        key={cat.id}
                                        onClick={() => {
                                          toggleCategoryFilter(cat.id);
                                        }}
                                        className="px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 hover:bg-white/5"
                                      >
                                        <div
                                          className={`w-3 h-3 rounded-sm flex items-center justify-center transition-all ${
                                            isSelected ? 'border-transparent' : 'border-2 border-gray-600'
                                          }`}
                                          style={{ backgroundColor: isSelected ? cat.color : 'transparent' }}
                                        >
                                          {isSelected && (
                                            <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                          )}
                                        </div>
                                        <Icon className="w-4 h-4" style={{ color: cat.color }} />
                                        <span className="text-sm text-white">{cat.label}</span>
                                        <span 
                                          className="text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
                                          style={{ 
                                            backgroundColor: `${cat.color}20`,
                                            color: cat.color
                                          }}
                                        >
                                          {isSelected ? 'Visible' : 'Hidden'}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}

                            {/* Tasks Section */}
                            {searchResults.tasks.length > 0 && (
                              <div>
                                <div className="px-3 py-2 text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-white/5 flex items-center gap-2">
                                  <CheckSquare className="w-3 h-3" />
                                  Tasks
                                </div>
                                {searchResults.tasks.map((task) => {
                                  globalIndex++;
                                  const idx = globalIndex;
                                  return (
                                    <div
                                      key={task._id}
                                      onClick={() => handleSearchResultClick({ ...task, type: 'task' })}
                                      className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                                        selectedSearchIndex === idx ? 'bg-indigo-500/20' : 'hover:bg-white/5'
                                      }`}
                                    >
                                      <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${
                                        task.completed ? 'bg-green-500/20 border-green-500' : 'border-gray-500'
                                      }`}>
                                        {task.completed && (
                                          <svg className="w-2.5 h-2.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className={`text-sm flex-1 truncate ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                                        {task.text}
                                      </span>
                                      {task.priority && task.priority !== 'none' && (
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                          task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                                          task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                                          'bg-blue-500/20 text-blue-400'
                                        }`}>
                                          {task.priority}
                                        </span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </GlassPanel>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* No Results Message */}
              <AnimatePresence>
                {isSearchOpen && searchQuery.length >= 2 && !isSearching && 
                 searchResults.events.length === 0 && searchResults.calendars.length === 0 && searchResults.tasks.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full left-0 right-0 mt-2 z-50"
                  >
                    <GlassPanel className="p-4 bg-black/90 border-white/10">
                      <p className="text-sm text-gray-400 text-center">No results found for "{searchQuery}"</p>
                    </GlassPanel>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative" ref={notificationRef}>
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative text-indigo-200 hover:text-white transition-colors focus:outline-none p-2 rounded-full hover:bg-white/5"
              >
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-400 ring-2 ring-black animate-pulse"></span>
                )}
              </motion.button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 z-50"
                  >
                    <GlassPanel className="p-0 overflow-hidden bg-black/80 border-white/10">
                      <div className="px-4 py-3 border-b border-white/10 flex justify-between items-center bg-white/5">
                        <h3 className="font-semibold text-white">Notifications</h3>
                        <div className="flex items-center space-x-2">
                          {notifications.length > 0 && (
                            <button onClick={clearNotifications} className="text-[10px] text-gray-400 hover:text-white uppercase tracking-wider">Clear</button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto custom-scrollbar">
                        {notifications.length > 0 ? (
                          notifications.map((n) => (
                            <div 
                              key={n._id} 
                              className={`px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${!n.isRead ? 'bg-blue-500/10' : ''}`}
                              onClick={() => !n.isRead && markAsRead(n._id)}
                            >
                              <p className={`text-sm ${!n.isRead ? 'text-white font-medium' : 'text-gray-400'}`}>{n.message}</p>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-gray-500">{new Date(n.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                <button onClick={(e) => { e.stopPropagation(); deleteNotification(n._id); }} className="text-gray-600 hover:text-red-400">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center text-gray-500 text-sm">No new notifications</div>
                        )}
                      </div>
                    </GlassPanel>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setEventSelectedDate(new Date()); setIsEventModalOpen(true); }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create
            </motion.button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 custom-scrollbar relative">
           {/* Add a subtle highlight at the top for depth */}
           <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent z-20" />
           <Outlet />
        </div>
      </main>

      <CalendarModal isOpen={isCalendarModalOpen} onClose={() => setIsCalendarModalOpen(false)} />
      <ShareCalendarModal
        key={`${calendarToShare?._id || 'none'}:${isShareModalOpen ? 'open' : 'closed'}`}
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        calendarId={calendarToShare?._id}
        calendarName={calendarToShare?.name}
      />
      <EventModal isOpen={isEventModalOpen} onClose={() => setIsEventModalOpen(false)} selectedDate={eventSelectedDate} />

      {/* Group Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsGroupModalOpen(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="w-full max-w-md relative z-10"
            >
              <GlassPanel className="p-0 border border-white/10 shadow-2xl bg-dark-bg/95 backdrop-blur-2xl">
                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-xl">
                      <Folder className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white">Create Group</h3>
                      <p className="text-sm text-gray-500">Group calendars for quick filtering</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-400 block mb-2">Group Name</label>
                    <input
                      type="text"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g., Work, Personal, Projects..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-gray-400 block mb-2">Select Calendars</label>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-white/5 rounded-xl p-2 border border-white/10">
                      {[...calendars, ...sharedCalendars].map(cal => (
                        <div
                          key={cal._id}
                          onClick={() => {
                            setSelectedCalendarsForGroup(prev => 
                              prev.includes(cal._id) 
                                ? prev.filter(id => id !== cal._id)
                                : [...prev, cal._id]
                            );
                          }}
                          className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all ${
                            selectedCalendarsForGroup.includes(cal._id) 
                              ? 'bg-amber-500/20 border border-amber-500/30' 
                              : 'hover:bg-white/5'
                          }`}
                        >
                          <div 
                            className="w-3 h-3 rounded-sm mr-3"
                            style={{ backgroundColor: cal.color }}
                          />
                          <span className="text-sm text-gray-300">{cal.name}</span>
                          {selectedCalendarsForGroup.includes(cal._id) && (
                            <svg className="w-4 h-4 text-amber-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">{selectedCalendarsForGroup.length} calendar(s) selected</p>
                  </div>
                </div>
                
                <div className="p-6 border-t border-white/5 flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setIsGroupModalOpen(false);
                      setNewGroupName('');
                      setSelectedCalendarsForGroup([]);
                    }}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (newGroupName.trim() && selectedCalendarsForGroup.length > 0) {
                        addGroup({
                          name: newGroupName.trim(),
                          calendarIds: selectedCalendarsForGroup,
                          color: '#f59e0b'
                        });
                        setIsGroupModalOpen(false);
                        setNewGroupName('');
                        setSelectedCalendarsForGroup([]);
                      }
                    }}
                    disabled={!newGroupName.trim() || selectedCalendarsForGroup.length === 0}
                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create Group
                  </button>
                </div>
              </GlassPanel>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Layout;
