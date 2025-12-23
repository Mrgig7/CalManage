import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCalendar } from '../context/CalendarContext';
import { 
  format, 
  isSameDay, 
  compareAsc, 
  startOfToday, 
  isAfter,
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  addDays, 
  isSameMonth as isSameMonthFns, 
  isToday as isTodayFns 
} from 'date-fns';
import { Video, MapPin, Clock, ChevronLeft, ChevronRight, FileText, Check, Loader2, ArrowRight, Trash2, Calendar as CalendarIcon, ExternalLink, CheckSquare, Sun, Moon, Sunset, Coffee } from 'lucide-react';
import { formatTimestamp } from '../utils/formatTimestamp';
import GlassPanel from '../components/UI/GlassPanel';
import HeroWidget from '../components/3D/HeroWidget';
import ErrorBoundary from '../components/ErrorBoundary';

// Helper for Mini Calendar (Styled for Dark/Glass)
const MiniCalendarGrid = ({ currentDate }) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
        for (let i = 0; i < 7; i++) {
            const isSelected = isTodayFns(day);
            const isCurrentMonth = isSameMonthFns(day, monthStart);

            days.push(
                <div key={day.toString()} className={`aspect-square flex items-center justify-center text-xs cursor-pointer rounded-full transition-all ${!isCurrentMonth ? 'text-gray-600' : 'text-gray-300 hover:bg-white/10 hover:text-white'} ${isSelected ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold shadow-lg shadow-blue-500/30' : ''}`}>
                    {format(day, 'd')}
                </div>
            );
            day = addDays(day, 1);
        }
        rows.push(
            <div className="grid grid-cols-7 gap-1" key={day.toString()}>
                {days}
            </div>
        );
        days = [];
    }

    return <div className="space-y-1">{rows}</div>;
};

// Dynamic greeting based on time of day
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return { text: 'Good Morning', icon: Coffee };
  if (hour >= 12 && hour < 17) return { text: 'Good Afternoon', icon: Sun };
  if (hour >= 17 && hour < 21) return { text: 'Good Evening', icon: Sunset };
  return { text: 'Good Night', icon: Moon };
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const { 
    calendars, 
    sharedCalendars, 
    visibleCalendarIds,
    selectedCategories,
    // Use cached events from context
    allCachedEvents,
    eventsLoading,
    visibilityInitialized
  } = useCalendar();
  
  const [currentDate, setCurrentDate] = useState(new Date()); 
  
  const [invites, setInvites] = useState([]);
  const [activities, setActivities] = useState([]);
  const [todaysTasks, setTodaysTasks] = useState([]);

  // Get dynamic greeting
  const greeting = getGreeting();

  useEffect(() => {
    const fetchData = async () => {
        if (!token) return;
        try {
            const invitesRes = await fetch('http://localhost:5000/api/shares/invites', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (invitesRes.ok) setInvites(await invitesRes.json());

            const activityRes = await fetch('http://localhost:5000/api/activity', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (activityRes.ok) setActivities(await activityRes.json());

            // Fetch tasks for today
            const tasksRes = await fetch('http://localhost:5000/api/tasks', {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (tasksRes.ok) {
                const allTasks = await tasksRes.json();
                const today = startOfToday();
                const todayEnd = new Date(today);
                todayEnd.setHours(23, 59, 59, 999);
                
                // Filter tasks due today (not completed, or completed today)
                const filteredTasks = allTasks.filter(task => {
                    if (!task.dueDate) return false;
                    const dueDate = new Date(task.dueDate);
                    return isSameDay(dueDate, today);
                });
                setTodaysTasks(filteredTasks);
            }
        } catch (error) {
            console.error(error);
        }
    };
    fetchData();
  }, [token]);

  // Use cached events - filter to today's events only
  // Also filter by BOTH calendar visibility AND category visibility
  // Skip visibility check if not yet initialized to prevent blank calendar on first load
  const todaysEvents = useMemo(() => {
    const today = startOfToday();
    return allCachedEvents
      .filter(ev => {
        // Skip visibility check if not initialized yet (show all events on first load)
        if (visibilityInitialized && !visibleCalendarIds.has(ev.calendarId)) return false;
        // Must be in a selected category (or have no category for legacy events)
        if (ev.category && !selectedCategories.has(ev.category)) return false;
        return true;
      })
      .filter(ev => {
        const start = new Date(ev.start);
        return isSameDay(start, today);
      })
      .sort((a, b) => compareAsc(new Date(a.start), new Date(b.start)));
  }, [allCachedEvents, visibleCalendarIds, selectedCategories, visibilityInitialized]);

  const now = new Date();
  
  // Separate all-day events from timed events
  const timedEvents = todaysEvents.filter(ev => !ev.allDay);
  const allDayEvents = todaysEvents.filter(ev => ev.allDay);
  
  // Count meetings vs events
  const meetingsCount = todaysEvents.filter(ev => ev.isMeeting).length;
  const eventsCount = todaysEvents.filter(ev => !ev.isMeeting).length;
  const tasksCount = todaysTasks.filter(t => !t.completed).length;
  
  // Separate all-day meetings from all-day events
  const allDayMeetings = allDayEvents.filter(ev => ev.isMeeting);
  const allDayRegularEvents = allDayEvents.filter(ev => !ev.isMeeting);
  
  // Only timed events count for "Up Next"
  const upNextIndex = timedEvents.findIndex(ev => isAfter(new Date(ev.end), now));
  const upNext = upNextIndex !== -1 ? timedEvents[upNextIndex] : null;
  
  // Rest of today includes remaining timed events (not all-day ones, they're separate)
  const remainingTimedEvents = upNextIndex !== -1 ? timedEvents.slice(upNextIndex + 1) : [];
  
  // Include incomplete tasks in rest of today
  const incompleteTasks = todaysTasks.filter(t => !t.completed);
  
  // Build summary text
  const buildSummaryText = () => {
    const parts = [];
    if (meetingsCount > 0) parts.push(`${meetingsCount} meeting${meetingsCount !== 1 ? 's' : ''}`);
    if (eventsCount > 0) parts.push(`${eventsCount} event${eventsCount !== 1 ? 's' : ''}`);
    if (tasksCount > 0) parts.push(`${tasksCount} task${tasksCount !== 1 ? 's' : ''}`);
    
    if (parts.length === 0) return 'No items scheduled for today.';
    if (parts.length === 1) return `You have ${parts[0]} scheduled for today.`;
    if (parts.length === 2) return `You have ${parts[0]} and ${parts[1]} scheduled for today.`;
    return `You have ${parts[0]}, ${parts[1]}, and ${parts[2]} scheduled for today.`;
  };

  const respondToInvite = async (id, status) => {
      try {
          const res = await fetch(`http://localhost:5000/api/shares/invites/${id}`, {
              method: 'PATCH',
              headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ status })
          });
          
          if (res.ok) {
              setInvites(invites.filter(i => i._id !== id));
              if (status === 'accepted') window.location.reload(); 
          }
      } catch (error) { console.error(error); }
  };

  // Only show loading if we have no cached events yet - otherwise show stale data
  if (eventsLoading && allCachedEvents.length === 0 && calendars.length > 0) {
      return (
        <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Column - Main Schedule */}
      <div className="lg:col-span-2 space-y-8">
        
        {/* Hero Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <GlassPanel className="p-8 flex flex-col justify-center relative overflow-hidden group">
                {/* Decorative gradient blob */}
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-500/30 transition-all duration-700" />
                
                <h2 className="text-3xl font-bold text-white mb-2 relative z-10 flex items-center gap-3">
                    <greeting.icon className="w-8 h-8 text-amber-400" />
                    <span>
                        {greeting.text},<br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
                            {user?.name?.split(' ')[0]}
                        </span>
                    </span>
                </h2>
                <p className="text-gray-400 relative z-10 mt-2">
                    {buildSummaryText()}
                </p>
                <div className="mt-6 flex items-center gap-3 relative z-10">
                    <button 
                        onClick={() => navigate('/calendar')}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-medium transition-all backdrop-blur-md border border-white/5"
                    >
                        View Calendar
                    </button>
                </div>
            </GlassPanel>

            <GlassPanel className="relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border-indigo-500/20">
                <div className="absolute inset-0 z-0">
                    <HeroWidget />
                </div>
                <div className="relative z-10 text-center pointer-events-none">
                    <div className="text-sm font-medium text-indigo-200 tracking-wider uppercase mb-1">Current Time</div>
                    <div className="text-4xl font-bold text-white tracking-tight">
                        {format(new Date(), 'h:mm a')}
                    </div>
                </div>
            </GlassPanel>
        </div>

        {/* All-Day Section */}
        {(allDayMeetings.length > 0 || allDayRegularEvents.length > 0) && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-widest pl-1 flex items-center gap-2">
              <Sun className="w-3 h-3" />
              All Day
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* All-day Meetings */}
              {allDayMeetings.map(event => (
                <GlassPanel key={event._id} hoverEffect className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center gap-3 mb-2">
                    <Video className="w-4 h-4 text-blue-400" />
                    <span className="text-xs font-bold text-blue-300 uppercase">All-Day Meeting</span>
                  </div>
                  <h4 className="text-base font-semibold text-white mb-3">{event.title}</h4>
                  <div className="flex items-center gap-2">
                    {event.meetingLink && (
                      <a 
                        href={event.meetingLink} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 transition-all flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Join
                      </a>
                    )}
                  </div>
                </GlassPanel>
              ))}
              
              {/* All-day Events */}
              {allDayRegularEvents.map(event => (
                <GlassPanel key={event._id} hoverEffect className="p-4 border-l-4 border-l-purple-500">
                  <div className="flex items-center gap-3 mb-2">
                    <CalendarIcon className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-bold text-purple-300 uppercase">All-Day Event</span>
                  </div>
                  <h4 className="text-base font-semibold text-white mb-2">{event.title}</h4>
                  {event.calendarName && (
                    <p className="text-xs text-gray-500">{event.calendarName}</p>
                  )}
                </GlassPanel>
              ))}
            </div>
          </div>
        )}

        {/* Up Next Card */}
        <div className="space-y-4">
           <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest pl-1">Up Next</h3>
           <GlassPanel className={`overflow-hidden border-l-4 ${upNext?.isMeeting ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
             <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
               <span className={`text-xs font-medium px-2 py-1 rounded border ${upNext?.isMeeting ? 'text-blue-300 bg-blue-500/10 border-blue-500/20' : 'text-purple-300 bg-purple-500/10 border-purple-500/20'}`}>
                  {upNext?.isMeeting ? 'MEETING' : 'EVENT'} HAPPENING SOON
               </span>
               {upNext?.isMeeting && <Video className="w-5 h-5 text-blue-400" />}
               {upNext && !upNext.isMeeting && <CalendarIcon className="w-5 h-5 text-purple-400" />}
             </div>
             
             <div className="p-8">
               {upNext ? (
                 <>
                   <h3 className="text-2xl font-bold text-white mb-4">{upNext.title}</h3>
                   <div className="flex flex-wrap gap-6 text-sm text-gray-400 mb-8">
                     <div className="flex items-center">
                       <Clock className="w-4 h-4 mr-2 text-indigo-400" />
                       <span className="text-gray-300">{formatTimestamp(upNext.start)} - {formatTimestamp(upNext.end)}</span>
                     </div>
                     {upNext.location && (
                       <div className="flex items-center">
                         <MapPin className="w-4 h-4 mr-2 text-indigo-400" />
                         <span className="text-gray-300">{upNext.location}</span>
                       </div>
                     )}
                     {upNext.isMeeting && upNext.meetingPlatform && (
                       <div className="flex items-center">
                         <Video className="w-4 h-4 mr-2 text-blue-400" />
                         <span className="text-blue-300 capitalize">{upNext.meetingPlatform}</span>
                       </div>
                     )}
                   </div>

                   {upNext.isMeeting ? (
                     /* Meeting Template */
                     <div className="flex items-center justify-between">
                       <div className="flex -space-x-2">
                          {upNext.attendees && upNext.attendees.length > 0 ? (
                            <>
                              {upNext.attendees.slice(0, 3).map((attendee, i) => (
                                <div key={i} className="w-8 h-8 rounded-full border-2 border-black bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-xs font-medium text-white">
                                  {attendee.email?.charAt(0).toUpperCase() || 'A'}
                                </div>
                              ))}
                              {upNext.attendees.length > 3 && (
                                <div className="w-8 h-8 rounded-full border-2 border-black bg-gray-800 flex items-center justify-center text-xs font-medium text-gray-400">
                                  +{upNext.attendees.length - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">No attendees</div>
                          )}
                       </div>
                       <div className="space-x-3">
                         <button className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                           Reschedule
                         </button>
                         {upNext.meetingLink ? (
                           <a 
                             href={upNext.meetingLink} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition-all inline-flex items-center gap-2"
                           >
                             <Video className="w-4 h-4" />
                             Join Meeting
                           </a>
                         ) : (
                           <button className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-500/25 transition-all">
                             Join Meeting
                           </button>
                         )}
                       </div>
                     </div>
                   ) : (
                     /* Event Template */
                     <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         {upNext.calendarName && (
                           <span className="text-sm text-purple-300/70 flex items-center gap-1">
                             <CalendarIcon className="w-4 h-4" />
                             {upNext.calendarName}
                           </span>
                         )}
                       </div>
                       <button 
                         onClick={() => navigate('/calendar')}
                         className="px-5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-500 shadow-lg shadow-purple-500/25 transition-all flex items-center gap-2"
                       >
                         <ArrowRight className="w-4 h-4" />
                         View Details
                       </button>
                     </div>
                   )}
                 </>
               ) : (
                 <div className="text-center py-8 text-gray-500">
                   No upcoming events for today. Relax and recharge! ☕
                 </div>
               )}
             </div>
           </GlassPanel>
        </div>

         {/* Rest of Today */}
        <div>
           <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-4 pl-1">Rest of Today</h3>
           <div className="space-y-3">
             {/* Remaining Timed Events */}
             {remainingTimedEvents.map(event => (
               <GlassPanel key={event._id} hoverEffect className={`p-4 flex items-center group border-l-4 ${event.isMeeting ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                  <div className="w-24 flex-shrink-0 text-right pr-4 border-r border-white/10 mr-4">
                    <p className="text-sm font-bold text-white">{formatTimestamp(event.start)}</p>
                    <p className="text-xs text-gray-500">{formatTimestamp(event.end)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {event.isMeeting ? (
                        <Video className="w-3 h-3 text-blue-400" />
                      ) : (
                        <CalendarIcon className="w-3 h-3 text-purple-400" />
                      )}
                      <h4 className={`text-sm font-semibold text-gray-200 truncate group-hover:${event.isMeeting ? 'text-blue-400' : 'text-purple-400'} transition-colors`}>
                        {event.title}
                      </h4>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {event.calendarName && <span className="text-indigo-300/60">{event.calendarName}</span>}
                    </p>
                  </div>
                  {event.isMeeting && event.meetingLink && (
                    <a 
                      href={event.meetingLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 flex items-center gap-1"
                    >
                      <Video className="w-3 h-3" />
                      Join
                    </a>
                  )}
                  {!event.isMeeting && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => navigate('/calendar', { state: { selectedDate: new Date(event.start) } })}
                        className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-purple-400"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
               </GlassPanel>
             ))}
             
             {/* Today's Tasks */}
             {incompleteTasks.map(task => (
               <GlassPanel 
                 key={task._id} 
                 hoverEffect 
                 className="p-4 flex items-center group border-l-4 border-l-amber-500 cursor-pointer"
                 onClick={() => navigate('/tasks')}
               >
                  <div className="w-24 flex-shrink-0 text-right pr-4 border-r border-white/10 mr-4">
                    <div className="flex items-center justify-end gap-1">
                      <CheckSquare className="w-3 h-3 text-amber-400" />
                      <span className="text-xs font-bold text-amber-400 uppercase">Task</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-200 truncate group-hover:text-amber-400 transition-colors">
                      {task.text}
                    </h4>
                  </div>
                  {task.priority && task.priority !== 'none' && (
                    <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${
                      task.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                      task.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {task.priority}
                    </span>
                  )}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </div>
               </GlassPanel>
             ))}
             
             {/* Empty State */}
             {remainingTimedEvents.length === 0 && incompleteTasks.length === 0 && (
               <div className="p-8 text-center border border-white/5 rounded-xl border-dashed">
                  <p className="text-gray-500 text-sm">No more items scheduled for today.</p>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Right Column - Widgets */}
      <div className="space-y-8">
        {/* Mini Calendar */}
        <GlassPanel className="p-6">
            <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold text-white">{format(currentDate, 'MMMM yyyy')}</h3>
                <div className="flex space-x-1">
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))} className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
            <div className="grid grid-cols-7 text-center text-[10px] uppercase font-bold tracking-wider mb-2">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                    <div key={d} className="text-indigo-300/50 py-1">{d}</div>
                ))}
            </div>
            <MiniCalendarGrid currentDate={currentDate} />
        </GlassPanel>

        {/* Pending Invitations */}
        <GlassPanel className="p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex justify-between items-center">
                Pending Invites
                {invites.length > 0 && <span className="bg-blue-500 text-white py-0.5 px-2 rounded-full text-[10px]">{invites.length}</span>}
            </h3>
            <div className="space-y-4">
                {invites.length > 0 ? (
                    invites.map(invite => (
                        <div key={invite._id} className="pb-4 border-b border-white/5 last:border-0 last:pb-0">
                            <p className="font-semibold text-sm text-gray-200">{invite.calendar?.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                Invited by <span className="text-indigo-300">{invite.calendar?.user?.name || 'Unknown'}</span>
                            </p>
                            <div className="flex gap-2 mt-3">
                                <button 
                                    onClick={() => respondToInvite(invite._id, 'accepted')}
                                    className="flex-1 py-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-medium rounded hover:bg-blue-600/30 transition-colors"
                                >
                                    Accept
                                </button>
                                <button 
                                    onClick={() => respondToInvite(invite._id, 'declined')}
                                    className="flex-1 py-1.5 bg-white/5 border border-white/10 text-gray-400 text-xs font-medium rounded hover:bg-white/10 transition-colors"
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-gray-500 italic">No pending invitations.</p>
                )}
            </div>
        </GlassPanel>

        {/* Recent Activity */}
        <GlassPanel className="p-6">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Recent Activity</h3>
            <div className="space-y-4">
                {activities.length > 0 ? (
                    activities.map(activity => (
                        <div key={activity._id} className="flex items-start space-x-3 group">
                            <div className={`mt-0.5 p-1.5 rounded-lg ${
                              activity.action === 'completed' 
                                ? 'bg-green-500/10 text-green-400' 
                                : activity.action === 'deleted'
                                  ? 'bg-red-500/10 text-red-400'
                                  : 'bg-blue-500/10 text-blue-400'
                            }`}>
                                {activity.action === 'completed' 
                                  ? <Check className="w-3 h-3" /> 
                                  : activity.action === 'deleted'
                                    ? <Trash2 className="w-3 h-3" />
                                    : <FileText className="w-3 h-3" />}
                            </div>
                            <div>
                                <p className="text-sm text-gray-300 group-hover:text-white transition-colors">
                                  {activity.details || (
                                    <>
                                      <span className="font-semibold text-indigo-300">You</span> {activity.action}{' '}
                                      <span className="font-semibold text-white">{activity.target}</span>
                                    </>
                                  )}
                                </p>
                                <p className="text-[10px] text-gray-600 mt-1">
                                    {formatTimestamp(activity.createdAt)}
                                </p>
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-sm text-gray-500 italic">No recent activity.</p>
                )}
            </div>
        </GlassPanel>
      </div>
    </div>
  );
};

export default Dashboard;
