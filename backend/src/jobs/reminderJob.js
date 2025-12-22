const cron = require('node-cron');
const Event = require('../models/Event');
const Notification = require('../models/Notification');
const Calendar = require('../models/Calendar'); // To get the user

const checkReminders = () => {
  cron.schedule('* * * * *', async () => {
    console.log('Checking for reminders...');
    const now = new Date();
    
    // Find events that have reminders not sent
    // This is a simplified logic. In production, you'd query more efficiently.
    // We look for events where start time - reminder time <= now
    
    // For efficiency, let's just find events starting in the next 24 hours
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    try {
      const events = await Event.find({
        start: { $gte: now, $lte: next24h },
        'reminders.sent': false,
      }).populate('calendar');

      for (const event of events) {
        let hasChanges = false;
        
        for (const reminder of event.reminders) {
          if (reminder.sent) continue;

          const reminderTime = new Date(event.start.getTime() - reminder.time * 60000);
          
          if (reminderTime <= now) {
            // Send notification
            // Get user from calendar
            const calendar = event.calendar;
            if (calendar) {
              try {
                await Notification.create({
                  user: calendar.user,
                  message: `Reminder: ${event.title || 'Untitled Event'} starts in ${reminder.time} minutes`,
                  type: 'reminder',
                  relatedId: event._id,
                });
                
                // Mark as sent
                reminder.sent = true;
                hasChanges = true;
              } catch (notifError) {
                console.error('Failed to create notification:', notifError.message);
              }
            }
          }
        }
        
        // Only save if we actually changed something
        if (hasChanges) {
          try {
            // Use updateOne to avoid full validation
            await Event.updateOne(
              { _id: event._id },
              { $set: { reminders: event.reminders } }
            );
          } catch (saveError) {
            console.error(`Failed to update reminders for event ${event._id}:`, saveError.message);
          }
        }
      }
    } catch (error) {
      console.error('Reminder job error:', error.message);
    }
  });
};

module.exports = checkReminders;
