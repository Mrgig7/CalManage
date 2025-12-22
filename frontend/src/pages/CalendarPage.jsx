import { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { useCalendar } from '../context/CalendarContext';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  addMonths, 
  subMonths,
  isToday,
  startOfYear,
  endOfYear,
  eachMonthOfInterval,
  getDay,
  getHours,
  addHours,
  setHours,
  setMinutes,
  differenceInMinutes,
  startOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Filter, MoreHorizontal, Clock, Trash2, X, MapPin } from 'lucide-react';
import EventModal from '../components/Modals/EventModal';
import { formatTimestamp } from '../utils/formatTimestamp';
import GlassPanel from '../components/UI/GlassPanel';
import { motion, AnimatePresence } from 'framer-motion';

const CalendarPage = () => {
    const { 
        calendars, 
        sharedCalendars, 
        deleteEvent, 
        visibleCalendarIds,
        // Use cached events from context
        allCachedEvents,
        eventsLoading,
        eventsLoaded,
        loadAllEvents
    } = useCalendar();
    
    const [currentDate, setCurrentDate] = useState(new Date());
    const [view, setView] = useState('month'); // 'day', 'week', 'month', 'year'
    const [isEventModalOpen, setIsEventModalOpen] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    // Use cached events directly - no more loading on every navigation
    // Events are already enriched with calendar info in context
    const events = useMemo(() => {
        return allCachedEvents.filter(ev => visibleCalendarIds.has(ev.calendarId));
    }, [allCachedEvents, visibleCalendarIds]);

    const nextPeriod = () => {
        if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
        else if (view === 'day') setCurrentDate(addDays(currentDate, 1));
        else if (view === 'year') setCurrentDate(addMonths(currentDate, 12));
    };

    const prevPeriod = () => {
        if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
        else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
        else if (view === 'day') setCurrentDate(addDays(currentDate, -1));
        else if (view === 'year') setCurrentDate(subMonths(currentDate, 12));
    };

    // Navigate to day view for the clicked date (used in month/week views)
    const handleDayClick = (date) => {
        setCurrentDate(date);
        setView('day');
    };

    const handleDateClick = (date) => {
        setSelectedDate(date);
        setIsEventModalOpen(true);
    };

    // State for event detail modal
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isEventDetailOpen, setIsEventDetailOpen] = useState(false);

    const handleEventClick = (e, event) => {
        e.stopPropagation();
        setSelectedEvent(event);
        setIsEventDetailOpen(true);
    };

    // --- Sub-components for Views ---

    // State for "more events" popover
    const [moreEventsPopover, setMoreEventsPopover] = useState({
        isOpen: false,
        day: null,
        events: [],
        position: { x: 0, y: 0 }
    });
    const moreEventsRef = useRef(null);

    // Close popover when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (moreEventsRef.current && !moreEventsRef.current.contains(event.target)) {
                setMoreEventsPopover(prev => ({ ...prev, isOpen: false }));
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const MonthView = () => {
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const days = eachDayOfInterval({ start: startDate, end: endDate });
        const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // Calculate number of weeks for proper row sizing
        const numWeeks = Math.ceil(days.length / 7);
        
        // Max events to show in a cell (rest will show as "+N more")
        const MAX_VISIBLE_EVENTS = 2;

        const handleMoreClick = (e, day, dayEvents) => {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            
            // Popover dimensions
            const popoverWidth = 288; // w-72 = 18rem = 288px
            const popoverHeight = Math.min(320, 80 + dayEvents.length * 70); // Estimate based on events
            const margin = 8;
            
            // Calculate available space in each direction
            const spaceBelow = window.innerHeight - rect.bottom - margin;
            const spaceAbove = rect.top - margin;
            const spaceRight = window.innerWidth - rect.left - margin;
            const spaceLeft = rect.right - margin;
            
            // Determine vertical position (prefer below, use above if not enough space)
            let yPos;
            if (spaceBelow >= popoverHeight) {
                yPos = rect.bottom + margin;
            } else if (spaceAbove >= popoverHeight) {
                yPos = rect.top - popoverHeight - margin;
            } else {
                // Not enough space either way, position to fit in remaining space
                yPos = Math.max(margin, window.innerHeight - popoverHeight - margin);
            }
            
            // Determine horizontal position (prefer align with button, adjust if overflow)
            let xPos;
            if (spaceRight >= popoverWidth) {
                xPos = rect.left;
            } else if (spaceLeft >= popoverWidth) {
                xPos = rect.right - popoverWidth;
            } else {
                // Center it horizontally if no good fit
                xPos = Math.max(margin, (window.innerWidth - popoverWidth) / 2);
            }
            
            setMoreEventsPopover({
                isOpen: true,
                day,
                events: [...dayEvents],
                position: { x: xPos, y: yPos }
            });
        };

        return (
            <div className="h-full flex flex-col blur-appear">
                {/* Weekday Headers */}
                <div className="grid grid-cols-7 mb-2 shrink-0">
                    {weekDays.map(day => (
                        <div key={day} className="text-center text-xs font-bold text-indigo-300/70 uppercase tracking-widest py-2">
                            {day}
                        </div>
                    ))}
                </div>
                
                {/* Calendar Grid - Fixed height, evenly distributed rows */}
                <div className="flex-1 grid grid-cols-7 gap-1.5" style={{ gridTemplateRows: `repeat(${numWeeks}, minmax(0, 1fr))` }}>
                    {days.map(day => {
                        const dayEvents = events.filter(ev => isSameDay(new Date(ev.start), day));
                        const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS);
                        const hiddenCount = dayEvents.length - MAX_VISIBLE_EVENTS;
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isCurrentDay = isToday(day);
                        
                        return (
                            <motion.div 
                                key={day.toString()}
                                onClick={() => handleDayClick(day)}
                                whileHover={{ scale: 1.02 }}
                                className={`
                                    p-1.5 rounded-xl border transition-all cursor-pointer relative group flex flex-col
                                    ${!isCurrentMonth 
                                        ? 'bg-white/3 border-white/5 text-gray-600' 
                                        : 'bg-glass-surface border-glass-border hover:bg-white/10 text-white shadow-lg'
                                    }
                                    ${isCurrentDay ? 'ring-2 ring-blue-500/50 bg-blue-500/10' : ''}
                                `}
                            >
                                {/* Day Number */}
                                <div className="flex justify-between items-center shrink-0 mb-1">
                                    <span className={`
                                        text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center
                                        ${isCurrentDay ? 'bg-blue-500 text-white shadow-glow' : ''}
                                    `}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayEvents.length > 0 && (
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 opacity-60" />
                                    )}
                                </div>
                                
                                {/* Events Container - Fixed size with overflow hidden */}
                                <div className="flex-1 space-y-0.5 overflow-hidden min-h-0">
                                    {visibleEvents.map(ev => (
                                        <motion.div 
                                            key={ev._id} 
                                            onClick={(e) => handleEventClick(e, ev)}
                                            whileHover={{ scale: 1.05 }}
                                            className="px-1.5 py-0.5 rounded text-[9px] font-medium truncate cursor-pointer transition-all"
                                            style={{ 
                                                backgroundColor: `${ev.color}25`, 
                                                color: ev.color,
                                                borderLeft: `2px solid ${ev.color}`,
                                            }}
                                        >
                                            {ev.title}
                                        </motion.div>
                                    ))}
                                    
                                    {/* "+N more" indicator */}
                                    {hiddenCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                handleMoreClick(e, day, dayEvents);
                                            }}
                                            className="w-full text-left px-1.5 py-0.5 text-[9px] font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-all"
                                        >
                                            +{hiddenCount} more
                                        </button>
                                    )}
                                </div>
                                
                                {/* Quick add button - appears on hover */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDateClick(day);
                                    }}
                                    className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-blue-500/20 text-blue-400 opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-500/40 flex items-center justify-center"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const WeekView = () => {
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(weekStart);
        const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
        const hours = Array.from({ length: 24 }, (_, i) => i);

        // Get all events for this week
        const weekEvents = events.filter(ev => {
            const evStart = new Date(ev.start);
            return evStart >= weekStart && evStart <= weekEnd;
        });
        
        // Separate all-day events from timed events
        const allDayEvents = weekEvents.filter(ev => ev.allDay);
        const timedEvents = weekEvents.filter(ev => !ev.allDay);

        // Calculate overlapping events for a specific day and assign columns
        const getEventPositionsForDay = (dayEvents) => {
            if (dayEvents.length === 0) return new Map();
            
            // Sort events by start time, then by duration (longer first)
            const sortedEvents = [...dayEvents].sort((a, b) => {
                const startDiff = new Date(a.start) - new Date(b.start);
                if (startDiff !== 0) return startDiff;
                return differenceInMinutes(new Date(b.end), new Date(b.start)) - 
                       differenceInMinutes(new Date(a.end), new Date(a.start));
            });
            
            const eventPositions = new Map();
            const groups = [];
            let currentGroup = [];
            let groupEnd = null;
            
            sortedEvents.forEach(event => {
                const evStart = new Date(event.start);
                const evEnd = new Date(event.end);
                
                if (currentGroup.length === 0 || evStart < groupEnd) {
                    currentGroup.push(event);
                    groupEnd = groupEnd ? (evEnd > groupEnd ? evEnd : groupEnd) : evEnd;
                } else {
                    if (currentGroup.length > 0) {
                        groups.push([...currentGroup]);
                    }
                    currentGroup = [event];
                    groupEnd = evEnd;
                }
            });
            
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            
            groups.forEach(group => {
                const columns = [];
                
                group.forEach(event => {
                    const evStart = new Date(event.start);
                    let placed = false;
                    
                    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                        const column = columns[colIndex];
                        const lastEventInColumn = column[column.length - 1];
                        const lastEnd = new Date(lastEventInColumn.end);
                        
                        if (evStart >= lastEnd) {
                            column.push(event);
                            eventPositions.set(event._id, { column: colIndex, totalColumns: 0 });
                            placed = true;
                            break;
                        }
                    }
                    
                    if (!placed) {
                        columns.push([event]);
                        eventPositions.set(event._id, { column: columns.length - 1, totalColumns: 0 });
                    }
                });
                
                const totalCols = columns.length;
                group.forEach(event => {
                    const pos = eventPositions.get(event._id);
                    pos.totalColumns = totalCols;
                });
            });
            
            return eventPositions;
        };

        // Pre-calculate positions for all days
        const allEventPositions = new Map();
        days.forEach(day => {
            const dayTimedEvents = timedEvents.filter(ev => isSameDay(new Date(ev.start), day));
            const positions = getEventPositionsForDay(dayTimedEvents);
            positions.forEach((pos, eventId) => {
                allEventPositions.set(eventId, pos);
            });
        });

        return (
            <div className="h-full flex flex-col overflow-hidden blur-appear">
                <div className="grid grid-cols-8 border-b border-white/10 pb-2">
                    <div className="text-xs text-gray-500 text-center pt-2">GMT</div>
                    {days.map(day => (
                        <div key={day.toString()} className={`text-center py-2 ${isToday(day) ? 'bg-blue-500/10 rounded-t-lg' : ''}`}>
                             <div className={`text-xs font-semibold uppercase ${isToday(day) ? 'text-blue-400' : 'text-gray-400'}`}>
                                 {format(day, 'EEE')}
                             </div>
                             <div className={`text-lg font-bold ${isToday(day) ? 'text-blue-500' : 'text-white'}`}>
                                 {format(day, 'd')}
                             </div>
                        </div>
                    ))}
                </div>

                {/* All-Day Events Row */}
                {allDayEvents.length > 0 && (
                    <div className="grid grid-cols-8 border-b border-amber-500/20 bg-amber-500/5 min-h-[40px]">
                        <div className="flex items-center justify-end pr-2">
                            <span className="text-[10px] font-semibold text-amber-300 uppercase">All Day</span>
                        </div>
                        {days.map(day => {
                            const dayAllDayEvents = allDayEvents.filter(ev => isSameDay(new Date(ev.start), day));
                            return (
                                <div key={day.toString()} className="flex flex-wrap gap-1 p-1">
                                    {dayAllDayEvents.map(ev => (
                                        <div
                                            key={ev._id}
                                            onClick={(e) => handleEventClick(e, ev)}
                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded truncate cursor-pointer hover:scale-105 transition-transform"
                                            style={{
                                                backgroundColor: `${ev.color}30`,
                                                borderLeft: `2px solid ${ev.color}`,
                                                color: 'white'
                                            }}
                                        >
                                            {ev.title}
                                        </div>
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                     {/* Grid Lines */}
                     <div className="absolute inset-0 grid grid-cols-8 pointer-events-none">
                        <div className="border-r border-white/5 bg-black/10"></div>
                        {days.map((_, i) => (
                             <div key={i} className="border-r border-white/5"></div>
                        ))}
                     </div>

                     {hours.map(hour => (
                         <div key={hour} className="grid grid-cols-8 h-16 min-h-[64px] border-b border-white/5 relative group hover:bg-white/5 transition-colors">
                             <div className="text-[10px] text-gray-500 text-right pr-2 pt-1 border-r border-white/5 -mt-2.5 bg-transparent">
                                 {format(setHours(new Date(), hour), 'h a')}
                             </div>
                             
                             {/* Clickable slots */}
                             {days.map(day => (
                                 <div 
                                    key={day.toString() + hour}
                                    onClick={() => handleDateClick(setHours(day, hour))}
                                    className="h-full cursor-pointer hover:bg-white/5"
                                 ></div>
                             ))}
                         </div>
                     ))}
                     
                     {/* Timed Events Overlay - with column-based positioning */}
                     {timedEvents.map(ev => {
                         const evStart = new Date(ev.start);
                         const evEnd = new Date(ev.end);
                         
                         const dayIndex = getDay(evStart); // 0 (Sun) - 6 (Sat)
                         const startHour = getHours(evStart);
                         const durationMinutes = differenceInMinutes(evEnd, evStart);
                         const top = (startHour * 64) + ((evStart.getMinutes() / 60) * 64);
                         const height = Math.max((durationMinutes / 60) * 64, 24); // Min height

                         // Get column position for this event
                         const position = allEventPositions.get(ev._id) || { column: 0, totalColumns: 1 };
                         const { column, totalColumns } = position;
                         
                         // Calculate width and left position within the day column
                         const dayColumnWidth = 100 / 8; // Each day column is 1/8 of width
                         const eventWidthPercent = (dayColumnWidth / totalColumns) - 0.3; // Small gap
                         const leftPercent = ((dayIndex + 1) * dayColumnWidth) + (column * (dayColumnWidth / totalColumns));
                         
                         // Determine what to show based on available space
                         const isNarrow = totalColumns >= 2;
                         const isTiny = height < 30;

                         return (
                             <motion.div
                                key={ev._id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                whileHover={{ scale: 1.05, zIndex: 50 }}
                                title={`${ev.title} • ${format(evStart, 'h:mm a')} - ${format(evEnd, 'h:mm a')}`}
                                className="absolute rounded-md p-1 text-xs border-l-2 shadow-lg overflow-hidden cursor-pointer"
                                style={{
                                    left: `${leftPercent}%`,
                                    width: `${eventWidthPercent}%`,
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    backgroundColor: `${ev.color}40`,
                                    borderColor: ev.color,
                                    color: 'white',
                                    backdropFilter: 'blur(4px)',
                                    zIndex: column + 1
                                }}
                                onClick={(e) => handleEventClick(e, ev)}
                             >
                                 <div className={`font-bold truncate ${isNarrow ? 'text-[10px]' : 'text-xs'}`}>
                                     {ev.title || 'Untitled'}
                                 </div>
                                 {!isTiny && (
                                     <div className="text-[9px] opacity-80 truncate">
                                         {format(evStart, 'h:mm a')}
                                     </div>
                                 )}
                             </motion.div>
                         );
                     })}
                </div>
            </div>
        );
    };

    const DayView = () => {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const dayEvents = events.filter(ev => isSameDay(new Date(ev.start), currentDate));
        
        // Separate all-day events from timed events
        const allDayEvents = dayEvents.filter(ev => ev.allDay);
        const timedEvents = dayEvents.filter(ev => !ev.allDay);

        // Calculate overlapping events and assign columns
        const getEventPositions = (events) => {
            if (events.length === 0) return [];
            
            // Sort events by start time, then by duration (longer first)
            const sortedEvents = [...events].sort((a, b) => {
                const startDiff = new Date(a.start) - new Date(b.start);
                if (startDiff !== 0) return startDiff;
                // If same start, longer events first
                return differenceInMinutes(new Date(b.end), new Date(b.start)) - 
                       differenceInMinutes(new Date(a.end), new Date(a.start));
            });
            
            // Each event will have: column index, total columns in its group
            const eventPositions = new Map();
            
            // Group overlapping events
            const groups = [];
            let currentGroup = [];
            let groupEnd = null;
            
            sortedEvents.forEach(event => {
                const evStart = new Date(event.start);
                const evEnd = new Date(event.end);
                
                if (currentGroup.length === 0 || evStart < groupEnd) {
                    // Event overlaps with current group
                    currentGroup.push(event);
                    groupEnd = groupEnd ? (evEnd > groupEnd ? evEnd : groupEnd) : evEnd;
                } else {
                    // Start new group
                    if (currentGroup.length > 0) {
                        groups.push([...currentGroup]);
                    }
                    currentGroup = [event];
                    groupEnd = evEnd;
                }
            });
            
            // Don't forget the last group
            if (currentGroup.length > 0) {
                groups.push(currentGroup);
            }
            
            // Assign columns within each group
            groups.forEach(group => {
                const columns = []; // Each column is an array of events
                
                group.forEach(event => {
                    const evStart = new Date(event.start);
                    
                    // Find first column where event doesn't overlap
                    let placed = false;
                    for (let colIndex = 0; colIndex < columns.length; colIndex++) {
                        const column = columns[colIndex];
                        const lastEventInColumn = column[column.length - 1];
                        const lastEnd = new Date(lastEventInColumn.end);
                        
                        if (evStart >= lastEnd) {
                            // Can place in this column
                            column.push(event);
                            eventPositions.set(event._id, { 
                                column: colIndex, 
                                totalColumns: 0 // Will update after
                            });
                            placed = true;
                            break;
                        }
                    }
                    
                    if (!placed) {
                        // Need new column
                        columns.push([event]);
                        eventPositions.set(event._id, { 
                            column: columns.length - 1, 
                            totalColumns: 0 
                        });
                    }
                });
                
                // Update total columns for all events in this group
                const totalCols = columns.length;
                group.forEach(event => {
                    const pos = eventPositions.get(event._id);
                    pos.totalColumns = totalCols;
                });
            });
            
            return eventPositions;
        };
        
        const eventPositions = getEventPositions(timedEvents);

        return (
            <div className="h-full flex flex-col overflow-hidden blur-appear">
                 <div className="flex items-center justify-between p-4 border-b border-white/10 bg-white/5">
                     <div className="flex flex-col">
                         <span className="text-sm font-semibold text-gray-400">{format(currentDate, 'EEEE')}</span>
                         <span className="text-3xl font-bold text-white">{format(currentDate, 'd')}</span>
                     </div>
                     <button onClick={() => setSelectedDate(currentDate) || setIsEventModalOpen(true)} className="px-4 py-2 bg-blue-600 rounded-lg text-white font-medium hover:bg-blue-700 transition-colors">
                         + Add Event
                     </button>
                 </div>

                 {/* All-Day Events Section */}
                 {allDayEvents.length > 0 && (
                     <div className="px-4 py-2 bg-amber-500/5 border-b border-amber-500/20">
                         <div className="flex items-center gap-2 mb-2">
                             <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                             <span className="text-xs font-semibold text-amber-300 uppercase tracking-wider">All Day</span>
                         </div>
                         <div className="flex flex-wrap gap-2">
                             {allDayEvents.map(ev => (
                                 <motion.div
                                     key={ev._id}
                                     initial={{ opacity: 0, scale: 0.9 }}
                                     animate={{ opacity: 1, scale: 1 }}
                                     onClick={(e) => handleEventClick(e, ev)}
                                     className="px-3 py-1.5 rounded-lg text-sm font-medium cursor-pointer hover:scale-105 transition-transform shadow-md"
                                     style={{
                                         backgroundColor: `${ev.color}25`,
                                         borderLeft: `3px solid ${ev.color}`,
                                         color: 'white'
                                     }}
                                 >
                                     {ev.title}
                                 </motion.div>
                             ))}
                         </div>
                     </div>
                 )}

                 <div className="flex-1 overflow-y-auto custom-scrollbar relative">
                     {hours.map(hour => (
                         <div key={hour} className="grid grid-cols-[60px_1fr] min-h-[80px] border-b border-white/5 hover:bg-white/5 transition-colors group">
                             <div className="text-xs text-gray-500 text-right pr-4 pt-2 border-r border-white/5">
                                 {format(setHours(new Date(), hour), 'h a')}
                             </div>
                             <div 
                                className="relative cursor-pointer"
                                onClick={() => handleDateClick(setHours(currentDate, hour))}
                             >
                                 {/* Horizontal line for easier reading */}
                                 <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-white/5 pointer-events-none"></div>
                             </div>
                         </div>
                     ))}

                     {/* Timed Events for the Day - with column-based positioning */}
                     {timedEvents.map(ev => {
                         const evStart = new Date(ev.start);
                         const evEnd = new Date(ev.end);
                         const startHour = getHours(evStart);
                         const durationMinutes = differenceInMinutes(evEnd, evStart);
                         const top = (startHour * 80) + ((evStart.getMinutes() / 60) * 80);
                         const height = Math.max((durationMinutes / 60) * 80, 40);
                         
                         // Get column position for this event
                         const position = eventPositions.get(ev._id) || { column: 0, totalColumns: 1 };
                         const { column, totalColumns } = position;
                         
                         // Calculate width and left position
                         // Available width is from 70px (after time column) to right edge (with 16px padding)
                         const eventWidth = `calc((100% - 86px) / ${totalColumns} - 4px)`; // 4px gap between events
                         const leftOffset = `calc(70px + (100% - 86px) / ${totalColumns} * ${column})`;
                         
                         // Determine what to show based on available space
                         const isNarrow = totalColumns >= 3;
                         const isShort = height < 60;
                         const isTiny = height < 45;

                         return (
                             <motion.div
                                key={ev._id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={(e) => handleEventClick(e, ev)}
                                title={`${ev.title} • ${format(evStart, 'h:mm a')} - ${format(evEnd, 'h:mm a')}`}
                                className="absolute rounded-xl p-2 border-l-4 shadow-lg cursor-pointer flex flex-col overflow-hidden hover:scale-[1.02] hover:z-50 transition-transform"
                                style={{
                                    top: `${top}px`,
                                    height: `${height}px`,
                                    left: leftOffset,
                                    width: eventWidth,
                                    backgroundColor: `${ev.color}35`,
                                    borderColor: ev.color,
                                    backdropFilter: 'blur(8px)',
                                    zIndex: column + 1
                                }}
                             >
                                 {/* Title - always show, adjust size based on space */}
                                 <div className={`font-bold text-white truncate ${isTiny ? 'text-[10px]' : isNarrow ? 'text-xs' : 'text-sm'}`}>
                                     {ev.title || 'Untitled'}
                                 </div>
                                 
                                 {/* Time - hide on tiny events, show compact on narrow */}
                                 {!isTiny && (
                                     <div className={`flex items-center text-gray-300 gap-1 mt-0.5 ${isNarrow ? 'text-[9px]' : 'text-xs'}`}>
                                         <Clock className={`flex-shrink-0 ${isNarrow ? 'w-2.5 h-2.5' : 'w-3 h-3'}`} />
                                         <span className="truncate">
                                             {isNarrow 
                                                 ? format(evStart, 'h:mm') 
                                                 : `${format(evStart, 'h:mm a')} - ${format(evEnd, 'h:mm a')}`
                                             }
                                         </span>
                                     </div>
                                 )}
                                 
                                 {/* Description - only on tall events with enough width */}
                                 {ev.description && height >= 80 && !isNarrow && (
                                     <div className="text-xs text-gray-400 mt-1 truncate">{ev.description}</div>
                                 )}
                             </motion.div>
                         );
                     })}
                 </div>
            </div>
        );
    };

    const YearView = () => {
        const yearStart = startOfYear(currentDate);
        const months = eachMonthOfInterval({ start: yearStart, end: endOfYear(currentDate) });

        return (
            <div className="h-full overflow-y-auto custom-scrollbar p-2 blur-appear">
                <div className="grid grid-cols-4 gap-4 h-full">
                    {months.map(month => (
                        <motion.div 
                            key={month.toString()}
                            whileHover={{ scale: 1.05 }}
                            onClick={() => {
                                setCurrentDate(month);
                                setView('month');
                            }}
                            className={`p-3 rounded-2xl border cursor-pointer flex flex-col items-center justify-between ${
                                isSameMonth(month, new Date()) 
                                    ? 'bg-gradient-to-br from-blue-900/30 to-purple-900/30 border-blue-500/30' 
                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                            }`}
                        >
                            <h3 className="text-lg font-bold text-white mb-2">{format(month, 'MMMM')}</h3>
                            
                            {/* Mini Calendar Grid for Visual Reference */}
                             <div className="grid grid-cols-7 gap-1 w-full text-[8px] text-gray-400">
                                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center">{d}</div>)}
                                {eachDayOfInterval({
                                    start: startOfWeek(startOfMonth(month)),
                                    end: endOfWeek(endOfMonth(month))
                                }).map((d, i) => (
                                    <div 
                                        key={i} 
                                        className={`
                                            aspect-square rounded-full flex items-center justify-center
                                            ${!isSameMonth(d, month) ? 'opacity-20' : ''}
                                            ${isToday(d) ? 'bg-blue-500 text-white' : ''}
                                        `}
                                    >
                                        {format(d, 'd')}
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col space-y-4">
            {/* Header / Controls */}
            <GlassPanel className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shrink-0 z-20">
                <div className="flex items-center space-x-4">
                    <h2 className="text-2xl font-bold text-white min-w-[200px] tracking-tight">
                        {format(currentDate, view === 'year' ? 'yyyy' : 'MMMM yyyy')}
                    </h2>
                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/10">
                        <button onClick={prevPeriod} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-4 text-xs font-bold text-gray-300 hover:text-white transition-colors border-x border-white/5 mx-1">
                            Today
                        </button>
                        <button onClick={nextPeriod} className="p-1.5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <div className="flex bg-black/40 rounded-xl p-1 border border-white/10 w-full sm:w-auto relative">
                        {['Day', 'Week', 'Month', 'Year'].map((v) => (
                            <button
                                key={v}
                                onClick={() => setView(v.toLowerCase())}
                                className={`flex-1 sm:flex-none px-5 py-1.5 rounded-lg text-sm font-medium transition-all relative z-10 ${
                                    view === v.toLowerCase()
                                        ? 'text-white shadow-lg'
                                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                                }`}
                            >
                                {v}
                                {view === v.toLowerCase() && (
                                    <motion.div 
                                        layoutId="viewTab"
                                        className="absolute inset-0 bg-blue-600 rounded-lg -z-10"
                                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                    <button className="p-2.5 bg-black/40 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                        <Filter className="w-4 h-4" />
                    </button>
                </div>
            </GlassPanel>

            {/* View Container */}
            <GlassPanel className="flex-1 p-4 overflow-hidden relative z-10">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={view + currentDate.toString()} // Unique key for every view/date change
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3, ease: "circOut" }}
                        className="h-full"
                    >
                        {view === 'month' && <MonthView />}
                        {view === 'week' && <WeekView />}
                        {view === 'day' && <DayView />}
                        {view === 'year' && <YearView />}
                    </motion.div>
                </AnimatePresence>
            </GlassPanel>

            <EventModal
                isOpen={isEventModalOpen}
                onClose={() => setIsEventModalOpen(false)}
                selectedDate={selectedDate}
            />

            {/* "More Events" Popover - Rendered at root level to avoid overflow clipping */}
            <AnimatePresence>
                {moreEventsPopover.isOpen && (
                    <motion.div
                        ref={moreEventsRef}
                        initial={{ opacity: 0, scale: 0.9, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: -10 }}
                        className="fixed z-[100] w-72 max-h-80 overflow-hidden bg-dark-bg/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/50"
                        style={{ 
                            left: moreEventsPopover.position.x,
                            top: moreEventsPopover.position.y 
                        }}
                    >
                        {/* Popover Header */}
                        <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                            <div>
                                <h4 className="font-bold text-white text-sm">
                                    {moreEventsPopover.day && format(moreEventsPopover.day, 'EEEE')}
                                </h4>
                                <p className="text-xs text-gray-500">
                                    {moreEventsPopover.day && format(moreEventsPopover.day, 'MMMM d, yyyy')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setMoreEventsPopover(prev => ({ ...prev, isOpen: false }))}
                                className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Events List */}
                        <div className="p-2 max-h-60 overflow-y-auto custom-scrollbar space-y-1">
                            {moreEventsPopover.events.map(ev => (
                                <motion.div
                                    key={ev._id}
                                    whileHover={{ scale: 1.02, x: 4 }}
                                    onClick={(e) => {
                                        handleEventClick(e, ev);
                                        setMoreEventsPopover(prev => ({ ...prev, isOpen: false }));
                                    }}
                                    className="p-2.5 rounded-xl cursor-pointer transition-all group/event"
                                    style={{ 
                                        backgroundColor: `${ev.color}15`,
                                        borderLeft: `3px solid ${ev.color}` 
                                    }}
                                >
                                    <div className="font-medium text-white text-sm truncate group-hover/event:text-blue-300 transition-colors">
                                        {ev.title}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                        <Clock className="w-3 h-3" />
                                        {ev.allDay ? (
                                            <span className="text-amber-400">All Day</span>
                                        ) : (
                                            <span>{format(new Date(ev.start), 'h:mm a')} - {format(new Date(ev.end), 'h:mm a')}</span>
                                        )}
                                    </div>
                                    {ev.calendarName && (
                                        <div className="text-[10px] text-gray-500 mt-1 truncate">
                                            {ev.calendarName}
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                        
                        {/* Quick Add Button */}
                        <div className="p-2 border-t border-white/10">
                            <button
                                type="button"
                                onClick={() => {
                                    handleDateClick(moreEventsPopover.day);
                                    setMoreEventsPopover(prev => ({ ...prev, isOpen: false }));
                                }}
                                className="w-full py-2 text-sm font-medium text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Event
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Event Detail Modal with Delete Option */}
            <AnimatePresence>
                {isEventDetailOpen && selectedEvent && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            onClick={() => setIsEventDetailOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 20 }}
                            className="w-full max-w-md relative z-10"
                        >
                            <GlassPanel className="p-0 border border-white/10 shadow-2xl bg-dark-bg/90 backdrop-blur-2xl">
                                <div className="p-6 border-b border-white/5 flex justify-between items-center">
                                    <h3 className="text-xl font-bold text-white">Event Details</h3>
                                    <button onClick={() => setIsEventDetailOpen(false)} className="text-gray-400 hover:text-white transition-colors">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                                
                                <div className="p-6 space-y-4">
                                    <div>
                                        <h4 className="text-2xl font-bold text-white">{selectedEvent.title}</h4>
                                        <p className="text-sm text-gray-400 mt-1">{selectedEvent.calendarName}</p>
                                    </div>
                                    
                                    <div className="flex items-center gap-3 text-gray-300">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        <span>{format(new Date(selectedEvent.start), 'PPP p')} - {format(new Date(selectedEvent.end), 'p')}</span>
                                    </div>
                                    
                                    {selectedEvent.location && (
                                        <div className="flex items-center gap-3 text-gray-300">
                                            <MapPin className="w-4 h-4 text-purple-400" />
                                            <span>{selectedEvent.location}</span>
                                        </div>
                                    )}
                                    
                                    {selectedEvent.description && (
                                        <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10">
                                            <p className="text-sm text-gray-300">{selectedEvent.description}</p>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-end gap-3 pt-4 border-t border-white/5 mt-6">
                                        <button
                                            type="button"
                                            onClick={() => setIsEventDetailOpen(false)}
                                            className="px-5 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                                        >
                                            Close
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                // Use the calendarId stored on the event
                                                const calendarId = selectedEvent.calendarId || selectedEvent.calendar;
                                                if (calendarId) {
                                                    const result = await deleteEvent(calendarId, selectedEvent._id);
                                                    if (result.success) {
                                                        // Cache is updated in context, just close the modal
                                                        setIsEventDetailOpen(false);
                                                    }
                                                }
                                            }}
                                            className="px-5 py-2 bg-red-600/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-semibold hover:bg-red-600/30 transition-all flex items-center gap-2"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                            Delete Event
                                        </button>
                                    </div>
                                </div>
                            </GlassPanel>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CalendarPage;
