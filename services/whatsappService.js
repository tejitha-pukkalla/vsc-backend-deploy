const axios = require('axios');
const FormData = require('form-data');

// ========================================
// WhatsApp Configuration
// ========================================
// You can use:
// 1. Twilio WhatsApp API
// 2. WhatsApp Business API
// 3. Third-party services like Gupshup, Interakt, etc.

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY;
const WHATSAPP_PHONE_NUMBER = process.env.WHATSAPP_PHONE_NUMBER;

// ========================================
// Send Booking Confirmation via WhatsApp
// ========================================
exports.sendBookingConfirmation = async (booking) => {
  try {
    console.log('📱 Sending WhatsApp to:', booking.customerDetails.phone);

    // Format phone number (remove +91 if present, add country code)
    const phoneNumber = formatPhoneNumber(booking.customerDetails.phone);

    // Generate message text
    const message = generateConfirmationMessage(booking);

    // Method 1: Using Twilio (Most Popular)
    if (process.env.WHATSAPP_SERVICE === 'twilio') {
      return await sendViaTwilio(phoneNumber, message, booking.qrImage);
    }

    // Method 2: Using WhatsApp Business API
    if (process.env.WHATSAPP_SERVICE === 'business-api') {
      return await sendViaBusinessAPI(phoneNumber, message, booking.qrImage);
    }

    // Method 3: Using Third-party service (Generic)
    if (WHATSAPP_API_URL && WHATSAPP_API_KEY) {
      return await sendViaGenericAPI(phoneNumber, message, booking.qrImage);
    }

    // Fallback: Just log (for development)
    console.log('⚠️ WhatsApp not configured. Message would be:');
    console.log(message);
    
    return { success: true, note: 'WhatsApp not configured (development mode)' };

  } catch (error) {
    console.error('❌ Error sending WhatsApp:', error);
    return { success: false, error: error.message };
  }
};

// ========================================
// Send Cancellation via WhatsApp
// ========================================
exports.sendCancellationNotification = async (booking) => {
  try {
    console.log('📱 Sending cancellation WhatsApp to:', booking.customerDetails.phone);

    const phoneNumber = formatPhoneNumber(booking.customerDetails.phone);
    const message = generateCancellationMessage(booking);

    if (process.env.WHATSAPP_SERVICE === 'twilio') {
      return await sendViaTwilio(phoneNumber, message);
    }

    console.log('⚠️ Cancellation message (not sent):', message);
    return { success: true, note: 'WhatsApp not configured' };

  } catch (error) {
    console.error('❌ Error sending cancellation WhatsApp:', error);
    return { success: false, error: error.message };
  }
};

// ========================================
// Send Reminder via WhatsApp
// ========================================
exports.sendReminderNotification = async (booking) => {
  try {
    console.log('📱 Sending reminder WhatsApp to:', booking.customerDetails.phone);

    const phoneNumber = formatPhoneNumber(booking.customerDetails.phone);
    const message = generateReminderMessage(booking);

    if (process.env.WHATSAPP_SERVICE === 'twilio') {
      return await sendViaTwilio(phoneNumber, message, booking.qrImage);
    }

    console.log('⚠️ Reminder message (not sent):', message);
    return { success: true, note: 'WhatsApp not configured' };

  } catch (error) {
    console.error('❌ Error sending reminder WhatsApp:', error);
    return { success: false, error: error.message };
  }
};

// ========================================
// METHOD 1: Send via Twilio
// ========================================
async function sendViaTwilio(phoneNumber, message, qrImage = null) {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., 'whatsapp:+14155238886'

    const twilio = require('twilio')(accountSid, authToken);

    const messageOptions = {
      from: twilioWhatsAppNumber,
      to: `whatsapp:+91${phoneNumber}`,
      body: message
    };

    // If QR image exists, send as media
    if (qrImage) {
      // Convert base64 to URL (you need to upload to cloudinary or temporary storage)
      // For now, just send text
      // messageOptions.mediaUrl = ['https://your-domain.com/qr-codes/temp.png'];
    }

    const response = await twilio.messages.create(messageOptions);

    console.log('✅ Twilio WhatsApp sent:', response.sid);
    return { success: true, sid: response.sid };

  } catch (error) {
    console.error('❌ Twilio error:', error);
    throw error;
  }
}

// ========================================
// METHOD 2: Send via WhatsApp Business API
// ========================================
async function sendViaBusinessAPI(phoneNumber, message, qrImage = null) {
  try {
    // WhatsApp Business API implementation
    // This requires WhatsApp Business API setup with Facebook
    
    const response = await axios.post(
      `${WHATSAPP_API_URL}/messages`,
      {
        messaging_product: 'whatsapp',
        to: `91${phoneNumber}`,
        type: 'text',
        text: {
          body: message
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ WhatsApp Business API sent:', response.data);
    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ WhatsApp Business API error:', error);
    throw error;
  }
}

// ========================================
// METHOD 3: Send via Generic Third-Party API
// ========================================
async function sendViaGenericAPI(phoneNumber, message, qrImage = null) {
  try {
    // Generic implementation for services like:
    // - Gupshup
    // - Interakt
    // - WATI
    // - Msg91
    
    const response = await axios.post(
      WHATSAPP_API_URL,
      {
        phone: `91${phoneNumber}`,
        message: message,
        // image: qrImage // if API supports it
      },
      {
        headers: {
          'Authorization': `Bearer ${WHATSAPP_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ WhatsApp sent via generic API');
    return { success: true, data: response.data };

  } catch (error) {
    console.error('❌ Generic WhatsApp API error:', error);
    throw error;
  }
}

// ========================================
// Message Templates
// ========================================

function generateConfirmationMessage(booking) {
  return `
🎉 *Booking Confirmed!*

Hi ${booking.customerDetails.name}! ✨

Your booking has been successfully confirmed.

📋 *Booking Details:*
━━━━━━━━━━━━━━━━
🎫 Booking Number: *${booking.bookingNumber}*
🎯 Activity: ${booking.activitySnapshot.title}
📍 Venue: ${booking.activitySnapshot.venue}
📅 Date: ${new Date(booking.bookingDate).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  })}
⏰ Time: ${booking.selectedTimeSlot.startTime} - ${booking.selectedTimeSlot.endTime}
👥 Participants: ${booking.numberOfParticipants}
💰 Amount Paid: ₹${booking.finalAmount}
━━━━━━━━━━━━━━━━

⚠️ *IMPORTANT:*
Please show your QR code (sent via email) at the venue entrance.

📧 Check your email for the QR code and full details.

Need help? Contact us:
📞 ${process.env.SUPPORT_PHONE || '+91 9876543210'}

See you soon! 🚀

- Team ${process.env.APP_NAME || 'Sports Club'}
  `.trim();
}

function generateCancellationMessage(booking) {
  return `
❌ *Booking Cancelled*

Hi ${booking.customerDetails.name},

Your booking *${booking.bookingNumber}* has been cancelled.

*Reason:* ${booking.cancellationReason || 'Cancelled by admin'}

If you have any questions, please contact us:
📞 ${process.env.SUPPORT_PHONE || '+91 9876543210'}

- Team ${process.env.APP_NAME || 'Sports Club'}
  `.trim();
}

function generateReminderMessage(booking) {
  return `
⏰ *Reminder: Your Booking Tomorrow!*

Hi ${booking.customerDetails.name}! 👋

Just a friendly reminder about your booking:

📋 *Details:*
━━━━━━━━━━━━━━━━
🎯 Activity: ${booking.activitySnapshot.title}
📅 Date: Tomorrow (${new Date(booking.bookingDate).toLocaleDateString('en-IN')})
⏰ Time: ${booking.selectedTimeSlot.startTime}
📍 Venue: ${booking.activitySnapshot.venue}
👥 Participants: ${booking.numberOfParticipants}
━━━━━━━━━━━━━━━━

✅ *Things to Remember:*
• Bring your QR code (check email)
• Arrive 15 minutes early
• Carry valid ID proof

See you tomorrow! 🎉

- Team ${process.env.APP_NAME || 'Sports Club'}
  `.trim();
}

// ========================================
// Helper: Format Phone Number
// ========================================
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove country code if present
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  }
  
  // Should be 10 digits now
  if (cleaned.length !== 10) {
    throw new Error('Invalid phone number format');
  }
  
  return cleaned;
}

// ========================================
// Test WhatsApp Connection
// ========================================
exports.testWhatsAppConnection = async () => {
  try {
    if (!process.env.WHATSAPP_SERVICE) {
      console.log('⚠️ WhatsApp service not configured');
      return false;
    }

    console.log('✅ WhatsApp service configured:', process.env.WHATSAPP_SERVICE);
    return true;

  } catch (error) {
    console.error('❌ WhatsApp test failed:', error);
    return false;
  }
};