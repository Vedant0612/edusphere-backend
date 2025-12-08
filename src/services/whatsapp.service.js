const twilio = require('twilio');

class WhatsAppService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SIDP,
      process.env.TWILIO_AUTH_TOKENP
    );
    this.fromNumber = process.env.TWILIO_WHATSAPP_NUMBERP;
  }

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

  async notifyApplicationStatus(phoneNumber, studentName, companyName, status) {
    const formattedNumber = this.formatPhoneNumber(phoneNumber);
    
    let message = '';
    
    if (status === 'accepted') {
      message = `🎉 Congratulations ${studentName}!

Your internship application at *${companyName}* has been *ACCEPTED*!

Check your dashboard for next steps. 🚀

- Prashikshan Team`;
    } else if (status === 'rejected') {
      message = `Hi ${studentName},

Your application at *${companyName}* was not successful this time.

Keep applying! More opportunities await. 💪

- Prashikshan Team`;
    } else if (status === 'pending') {
      message = `Hi ${studentName},

Your application at *${companyName}* is now under review. 📋

We'll keep you updated!

- Prashikshan Team`;
    }

    return await this.sendMessage(formattedNumber, message);
  }

  formatPhoneNumber(phone) {
    let cleaned = phone.replace(/[^\d+]/g, '');
    
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

module.exports = new WhatsAppService();