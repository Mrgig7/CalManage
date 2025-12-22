const Event = require('../models/Event');
const Calendar = require('../models/Calendar');
const CalendarShare = require('../models/CalendarShare');
const Task = require('../models/Task');

// @desc    Search across events, calendars, and tasks
// @route   GET /api/search
// @access  Private
const search = async (req, res) => {
  try {
    const { q } = req.query;
    
    // Min 2 characters required
    if (!q || q.length < 2) {
      return res.status(200).json({ events: [], calendars: [], tasks: [] });
    }

    const userId = req.user.id;
    const searchRegex = new RegExp(q, 'i');

    // Get user's own calendars
    const ownCalendars = await Calendar.find({ user: userId }).select('_id name color');
    const ownCalendarIds = ownCalendars.map(c => c._id);

    // Get shared calendars (accepted shares only)
    const sharedAccess = await CalendarShare.find({ 
      sharedWith: userId, 
      status: 'accepted' 
    }).populate('calendar', '_id name color');
    
    const sharedCalendars = sharedAccess
      .filter(s => s.calendar)
      .map(s => ({
        _id: s.calendar._id,
        name: s.calendar.name,
        color: s.calendar.color,
        isShared: true,
        role: s.role
      }));
    const sharedCalendarIds = sharedCalendars.map(c => c._id);

    // All accessible calendar IDs
    const allCalendarIds = [...ownCalendarIds, ...sharedCalendarIds];

    // Search events (title, description) in accessible calendars
    const events = await Event.find({
      calendar: { $in: allCalendarIds },
      $or: [
        { title: searchRegex },
        { description: searchRegex }
      ]
    })
    .populate('calendar', 'name color')
    .select('title description start end calendar allDay')
    .sort({ start: 1 })
    .limit(10);

    // Search calendars by name (owned + shared)
    const matchingOwnCalendars = ownCalendars.filter(c => searchRegex.test(c.name));
    const matchingSharedCalendars = sharedCalendars.filter(c => searchRegex.test(c.name));
    const calendars = [...matchingOwnCalendars, ...matchingSharedCalendars].slice(0, 10);

    // Search tasks by text
    const tasks = await Task.find({
      user: userId,
      text: searchRegex
    })
    .select('text completed priority dueDate')
    .sort({ createdAt: -1 })
    .limit(10);

    res.status(200).json({
      events: events.map(e => ({
        _id: e._id,
        title: e.title,
        description: e.description,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        calendarName: e.calendar?.name,
        calendarColor: e.calendar?.color
      })),
      calendars: calendars.map(c => ({
        _id: c._id,
        name: c.name,
        color: c.color,
        isShared: c.isShared || false
      })),
      tasks: tasks.map(t => ({
        _id: t._id,
        text: t.text,
        completed: t.completed,
        priority: t.priority,
        dueDate: t.dueDate
      }))
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Server error during search' });
  }
};

module.exports = { search };
