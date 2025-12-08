// services/whatsapp.service.js
const twilio = require('twilio');

class WhatsAppService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBER; // e.g., 'whatsapp:+14155238886'
  }

  /**
   * Send a WhatsApp message
   * @param {string} to - Recipient's WhatsApp number (e.g., 'whatsapp:+919876543210')
   * @param {string} message - Message text
   */
  async sendMessage(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to
      });
      
      console.log('✅ WhatsApp message sent:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('❌ WhatsApp send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send WhatsApp with media (image/document)
   * @param {string} to - Recipient's WhatsApp number
   * @param {string} message - Message text
   * @param {string} mediaUrl - URL of the media file
   */
  async sendMediaMessage(to, message, mediaUrl) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromNumber,
        to: to,
        mediaUrl: [mediaUrl]
      });
      
      console.log('✅ WhatsApp media message sent:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('❌ WhatsApp media send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send template message (for approved templates)
   * @param {string} to - Recipient's WhatsApp number
   * @param {string} templateSid - Template SID from Twilio
   * @param {object} variables - Template variables
   */
  async sendTemplateMessage(to, templateSid, variables = {}) {
    try {
      const result = await this.client.messages.create({
        from: this.fromNumber,
        to: to,
        contentSid: templateSid,
        contentVariables: JSON.stringify(variables)
      });
      
      console.log('✅ WhatsApp template sent:', result.sid);
      return { success: true, messageId: result.sid };
    } catch (error) {
      console.error('❌ WhatsApp template send failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================
  // PRE-BUILT NOTIFICATION TEMPLATES
  // ============================================

  /**
   * Notify student about internship application status
   */
  async notifyApplicationStatus(phoneNumber, studentName, companyName, status) {
    const message = `Hi ${studentName}! 👋

Your internship application at *${companyName}* has been *${status}*.

${status === 'accepted' ? '🎉 Congratulations! Check your dashboard for next steps.' : ''}
${status === 'rejected' ? 'Keep applying! More opportunities await.' : ''}

- Prashikshan Team`;

    return await this.sendMessage(`whatsapp:${phoneNumber}`, message);
  }

  /**
   * Notify about new chat message
   */
  async notifyNewMessage(phoneNumber, senderName, roomName, messagePreview) {
    const message = `💬 New message from *${senderName}* in *${roomName}*:

"${messagePreview}"

Reply on Prashikshan app.`;

    return await this.sendMessage(`whatsapp:${phoneNumber}`, message);
  }

  /**
   * Notify about internship deadline
   */
  async notifyDeadline(phoneNumber, studentName, taskName, dueDate) {
    const message = `⏰ Reminder for ${studentName}!

Your task "*${taskName}*" is due on *${dueDate}*.

Don't forget to complete it on time! 🚀

- Prashikshan`;

    return await this.sendMessage(`whatsapp:${phoneNumber}`, message);
  }

  /**
   * Notify mentor about student activity
   */
  async notifyMentor(phoneNumber, mentorName, studentName, activity) {
    const message = `Hi ${mentorName},

Your mentee *${studentName}* has ${activity}.

Check the dashboard for details.

- Prashikshan`;

    return await this.sendMessage(`whatsapp:${phoneNumber}`, message);
  }

  /**
   * Send certificate notification
   */
  async notifyCertificate(phoneNumber, studentName, certificateName, downloadLink) {
    const message = `🎓 Congratulations ${studentName}!

Your *${certificateName}* is ready!

Download: ${downloadLink}

- Prashikshan Team`;

    return await this.sendMessage(`whatsapp:${phoneNumber}`, message);
  }

  /**
   * Format phone number to WhatsApp format
   * @param {string} phone - Phone number (e.g., '9876543210' or '+919876543210')
   * @returns {string} Formatted number (e.g., 'whatsapp:+919876543210')
   */
  formatPhoneNumber(phone) {
    // Remove any spaces or special characters
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    // Add country code if not present (assuming India +91)
    if (!cleaned.startsWith('+')) {
      if (cleaned.startsWith('91')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+91' + cleaned;
      }
    }
    
    return `whatsapp:${cleaned}`;
  }
}

// Export singleton instance
module.exports = new WhatsAppService();