const sendEmail = require('./emailService');

// In-memory email queue
const emailQueue = [];
let isProcessing = false;

/**
 * Add an email to the queue for async processing
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email HTML body
 */
const queueEmail = (to, subject, html) => {
  emailQueue.push({ to, subject, html, attempts: 0, addedAt: Date.now() });
  console.log(`[EmailQueue] Email queued for: ${to} (Queue size: ${emailQueue.length})`);
};

/**
 * Process emails in the queue
 * Runs in background, non-blocking
 */
const processQueue = async () => {
  if (isProcessing || emailQueue.length === 0) return;
  
  isProcessing = true;
  
  try {
    // Process up to 5 emails per batch to avoid overloading SMTP
    const batch = emailQueue.splice(0, 5);
    
    for (const email of batch) {
      try {
        console.log(`[EmailQueue] Sending email to: ${email.to}`);
        await sendEmail(email.to, email.subject, email.html);
        console.log(`[EmailQueue] ✓ Email sent to: ${email.to}`);
      } catch (error) {
        console.error(`[EmailQueue] ✗ Failed to send email to ${email.to}:`, error.message);
        
        // Retry logic: re-queue failed emails up to 3 attempts
        if (email.attempts < 3) {
          email.attempts++;
          emailQueue.push(email);
          console.log(`[EmailQueue] Re-queued email for ${email.to} (attempt ${email.attempts}/3)`);
        } else {
          console.error(`[EmailQueue] Giving up on email to ${email.to} after 3 attempts`);
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

/**
 * Get current queue status (for debugging/monitoring)
 */
const getQueueStatus = () => ({
  queueSize: emailQueue.length,
  isProcessing
});

// Start the queue processor - runs every 2 seconds
const PROCESS_INTERVAL = 2000;
setInterval(processQueue, PROCESS_INTERVAL);
console.log(`[EmailQueue] Email queue processor started (interval: ${PROCESS_INTERVAL}ms)`);

module.exports = {
  queueEmail,
  getQueueStatus
};
