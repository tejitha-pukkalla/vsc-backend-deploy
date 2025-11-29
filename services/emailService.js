const nodemailer = require('nodemailer');

// Create transporter (Configure with your email service)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_EMAIL,
    pass: process.env.SMTP_PASSWORD
  }
});

// ========================================
// Send Booking Confirmation Email
// ========================================
exports.sendBookingConfirmation = async (booking) => {
  try {
    console.log('📧 Sending confirmation email to:', booking.customerDetails.email);

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Sports Club'}" <${process.env.SMTP_EMAIL}>`,
      to: booking.customerDetails.email,
      subject: `Booking Confirmed - ${booking.bookingNumber}`,
      html: generateConfirmationEmailHTML(booking),
      attachments: [
        {
          filename: 'qr-code.png',
          content: booking.qrImage.split('base64,')[1],
          encoding: 'base64'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending email:', error);
    // Don't throw - just log the error
    return { success: false, error: error.message };
  }
};

// ========================================
// Send Cancellation Email
// ========================================
exports.sendCancellationEmail = async (booking) => {
  try {
    console.log('📧 Sending cancellation email to:', booking.customerDetails.email);

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Sports Club'}" <${process.env.SMTP_EMAIL}>`,
      to: booking.customerDetails.email,
      subject: `Booking Cancelled - ${booking.bookingNumber}`,
      html: generateCancellationEmailHTML(booking)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Cancellation email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending cancellation email:', error);
    return { success: false, error: error.message };
  }
};

// ========================================
// Send Reminder Email (1 day before event)
// ========================================
exports.sendReminderEmail = async (booking) => {
  try {
    console.log('📧 Sending reminder email to:', booking.customerDetails.email);

    const mailOptions = {
      from: `"${process.env.APP_NAME || 'Sports Club'}" <${process.env.SMTP_EMAIL}>`,
      to: booking.customerDetails.email,
      subject: `Reminder: Your Booking Tomorrow - ${booking.bookingNumber}`,
      html: generateReminderEmailHTML(booking),
      attachments: [
        {
          filename: 'qr-code.png',
          content: booking.qrImage.split('base64,')[1],
          encoding: 'base64'
        }
      ]
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Reminder email sent:', info.messageId);
    
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Error sending reminder email:', error);
    return { success: false, error: error.message };
  }
};

// ========================================
// HTML Email Templates
// ========================================

function generateConfirmationEmailHTML(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Booking Confirmation</title>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #ffffff;
          padding: 30px;
          border: 1px solid #e0e0e0;
        }
        .booking-details {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid #ddd;
        }
        .detail-label {
          font-weight: bold;
          color: #555;
        }
        .detail-value {
          color: #333;
        }
        .qr-section {
          text-align: center;
          padding: 20px;
          background: #f9f9f9;
          border-radius: 8px;
          margin: 20px 0;
        }
        .qr-code {
          max-width: 250px;
          margin: 20px auto;
        }
        .highlight {
          background: #fff3cd;
          padding: 15px;
          border-left: 4px solid #ffc107;
          margin: 20px 0;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #777;
          font-size: 12px;
        }
        .button {
          display: inline-block;
          padding: 12px 30px;
          background: #667eea;
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Booking Confirmed!</h1>
        <p>Your booking has been successfully confirmed</p>
      </div>
      
      <div class="content">
        <p>Dear <strong>${booking.customerDetails.name}</strong>,</p>
        
        <p>Thank you for your booking! We're excited to see you soon.</p>
        
        <div class="booking-details">
          <h2>📋 Booking Details</h2>
          
          <div class="detail-row">
            <span class="detail-label">Booking Number:</span>
            <span class="detail-value"><strong>${booking.bookingNumber}</strong></span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Activity:</span>
            <span class="detail-value">${booking.activitySnapshot.title}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Venue:</span>
            <span class="detail-value">${booking.activitySnapshot.venue}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Address:</span>
            <span class="detail-value">${booking.activitySnapshot.address}, ${booking.activitySnapshot.city}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Date:</span>
            <span class="detail-value">${new Date(booking.bookingDate).toLocaleDateString('en-IN', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Time:</span>
            <span class="detail-value">${booking.selectedTimeSlot.startTime} - ${booking.selectedTimeSlot.endTime}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Participants:</span>
            <span class="detail-value">${booking.numberOfParticipants}</span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Amount Paid:</span>
            <span class="detail-value"><strong>₹${booking.finalAmount}</strong></span>
          </div>
          
          <div class="detail-row">
            <span class="detail-label">Transaction ID:</span>
            <span class="detail-value">${booking.transactionId}</span>
          </div>
        </div>
        
        <div class="highlight">
          <strong>⚠️ Important:</strong> Please show this QR code at the venue entrance.
        </div>
        
        <div class="qr-section">
          <h3>📱 Your Entry QR Code</h3>
          <img src="cid:qr-code.png" alt="QR Code" class="qr-code" />
          <p style="color: #666; font-size: 14px;">
            Save this QR code or show this email at the venue
          </p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/booking/${booking._id}" class="button">
            View Booking Details
          </a>
        </div>
        
        <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h4>📝 What to Bring:</h4>
          <ul>
            <li>This QR code (digital or printed)</li>
            <li>Valid ID proof</li>
            <li>Comfortable clothing</li>
          </ul>
        </div>
        
        <p style="margin-top: 30px;">
          If you have any questions, please contact us at:<br>
          📧 ${process.env.SUPPORT_EMAIL || 'support@sportsclub.com'}<br>
          📞 ${process.env.SUPPORT_PHONE || '+91 9876543210'}
        </p>
        
        <p>See you soon!</p>
        <p><strong>Team ${process.env.APP_NAME || 'Sports Club'}</strong></p>
      </div>
      
      <div class="footer">
        <p>&copy; ${new Date().getFullYear()} ${process.env.APP_NAME || 'Sports Club'}. All rights reserved.</p>
        <p>This is an automated email. Please do not reply to this email.</p>
      </div>
    </body>
    </html>
  `;
}

function generateCancellationEmailHTML(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>❌ Booking Cancelled</h1>
      </div>
      <div class="content">
        <p>Dear <strong>${booking.customerDetails.name}</strong>,</p>
        <p>Your booking <strong>${booking.bookingNumber}</strong> has been cancelled.</p>
        <p><strong>Reason:</strong> ${booking.cancellationReason || 'Cancelled by admin'}</p>
        <p>If you believe this is an error, please contact us immediately.</p>
        <p>Thank you,<br><strong>Team ${process.env.APP_NAME || 'Sports Club'}</strong></p>
      </div>
    </body>
    </html>
  `;
}

function generateReminderEmailHTML(booking) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .qr-code { max-width: 250px; margin: 20px auto; display: block; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>⏰ Reminder: Your Booking Tomorrow!</h1>
      </div>
      <div class="content">
        <p>Dear <strong>${booking.customerDetails.name}</strong>,</p>
        <p>This is a friendly reminder about your booking tomorrow:</p>
        <p>
          <strong>Activity:</strong> ${booking.activitySnapshot.title}<br>
          <strong>Date:</strong> ${new Date(booking.bookingDate).toLocaleDateString()}<br>
          <strong>Time:</strong> ${booking.selectedTimeSlot.startTime}<br>
          <strong>Venue:</strong> ${booking.activitySnapshot.venue}
        </p>
        <p><strong>Don't forget to bring your QR code:</strong></p>
        <img src="cid:qr-code.png" alt="QR Code" class="qr-code" />
        <p>See you tomorrow!</p>
        <p><strong>Team ${process.env.APP_NAME || 'Sports Club'}</strong></p>
      </div>
    </body>
    </html>
  `;
}

// Test email configuration
exports.testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ Email server is ready');
    return true;
  } catch (error) {
    console.error('❌ Email server connection failed:', error);
    return false;
  }
};