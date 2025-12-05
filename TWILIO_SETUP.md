# Twilio SMS Integration Setup Guide

## Overview
The internship posting system automatically sends SMS notifications to students whose skills match the internship requirements (minimum 2 matching skills).

## Prerequisites
1. Twilio Account (Sign up at https://www.twilio.com)
2. Twilio Phone Number (purchased from Twilio console)

## Setup Steps

### 1. Create Twilio Account
- Go to https://www.twilio.com/try-twilio
- Sign up for a free trial account
- Verify your email and phone number

### 2. Get Twilio Credentials
1. Log in to Twilio Console: https://console.twilio.com
2. Find your **Account SID** and **Auth Token** on the dashboard
3. Note these down - you'll need them for `.env`

### 3. Get a Phone Number
1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. Choose a phone number (trial accounts get one free number)
3. Make sure the number has **SMS** capability enabled
4. Note down the phone number in format: `+1234567890`

### 4. Configure Environment Variables
Add to your `.env` file:

```env
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token_here"
TWILIO_PHONE_NUMBER="+1234567890"
```

### 5. Trial Account Limitations
⚠️ **Important for Trial Accounts:**
- Can only send SMS to **verified phone numbers**
- To verify a phone number:
  1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified
  2. Click "Add a new number"
  3. Enter the phone number and verify via SMS code
  4. Repeat for all test phone numbers

### 6. Upgrade for Production
For production use:
1. Upgrade your Twilio account (https://console.twilio.com/billing)
2. Add payment method
3. Remove trial limitations (can send to any number)

## How It Works

### Skill Matching Algorithm
When a company posts an internship:

1. **Extract Required Skills**: e.g., `["JavaScript", "React", "Node.js", "MongoDB"]`

2. **Find Students**: Query all students with non-empty skills array

3. **Match Skills**: For each student, count matching skills (case-insensitive)
   ```javascript
   Student Skills: ["javascript", "python", "react", "sql"]
   Required Skills: ["JavaScript", "React", "Node.js", "MongoDB"]
   Matches: 2 (JavaScript, React)
   ```

4. **Filter**: Only students with **≥ 2 matching skills** receive SMS

5. **Send SMS**: Asynchronous SMS notifications with internship details

### SMS Message Format
```
🎓 New Internship Alert!

"Full Stack Developer Internship" at Google

✅ 3 of your skills match!

Check the portal for details and apply now!
```

## Testing

### Test Internship Creation
```bash
POST http://localhost:8000/internships
Authorization: Bearer <company-token>
Content-Type: application/json

{
  "title": "Full Stack Developer Internship",
  "description": "Join our team...",
  "type": "remote",
  "stipend": 10000,
  "location": "Remote",
  "required_skills": ["JavaScript", "React", "Node.js", "MongoDB"],
  "duration_weeks": 12,
  "industry_user_id": "company-user-id"
}
```

### Expected Response
```json
{
  "message": "Internship created",
  "internship": {
    "id": "...",
    "title": "Full Stack Developer Internship",
    "required_skills": ["JavaScript", "React", "Node.js", "MongoDB"],
    ...
  },
  "notificationsSent": 5,
  "matchingStudents": 5
}
```

### Check Logs
```bash
# Terminal output
Found 5 students with matching skills (minimum 2)
SMS sent to John Doe (+1234567890)
SMS sent to Jane Smith (+1234567891)
Skipping SMS for Bob Jones - no phone number
SMS notification summary: 4/5 sent successfully
```

## Student Setup Requirements

For students to receive SMS:
1. **Phone Number**: Must be set in `users.phone` field
2. **Skills**: Must have skills array in `profile.skills`
3. **Verified Number** (Trial only): Phone must be verified in Twilio Console

### Update Student Phone
```bash
PATCH /users/:id
Authorization: Bearer <token>

{
  "phone": "+1234567890"
}
```

### Update Student Skills
```bash
PATCH /students/:id/profile
Authorization: Bearer <token>

{
  "skills": ["JavaScript", "React", "Python", "SQL"]
}
```

## Troubleshooting

### No SMS Received

**Check 1: Twilio Configuration**
```bash
# In terminal, check logs
Twilio not configured. Add TWILIO_ACCOUNT_SID...
```
→ Solution: Add Twilio credentials to `.env`

**Check 2: Phone Number Format**
```bash
# Phone should be in E.164 format
✅ Correct: "+1234567890"
❌ Wrong: "1234567890", "(123) 456-7890"
```

**Check 3: Verified Numbers (Trial)**
```bash
# Log message
Failed to send SMS to +1234567890: The number +1234567890 is unverified...
```
→ Solution: Verify the phone number in Twilio Console

**Check 4: Skill Matching**
```bash
# Check if student has matching skills
Found 0 students with matching skills (minimum 2)
```
→ Solution: Ensure students have at least 2 matching skills

### SMS Delivery Delays
- Twilio typically delivers SMS within seconds
- Check Twilio Console → Logs for delivery status
- International numbers may take longer

### Rate Limits
Free tier limits:
- Trial: ~100 SMS/month
- Paid: Check your plan limits

### Cost Estimation
- SMS costs: ~$0.0075 per message (US)
- 100 students = ~$0.75 per internship post

## Advanced Configuration

### Customize SMS Template
Edit in `internships.routes.js`:

```javascript
const message = await twilioClient.messages.create({
  body: `🎓 Custom message here...`,
  from: TWILIO_PHONE_NUMBER,
  to: phoneNumber
});
```

### Add Rate Limiting
Install `rate-limiter-flexible`:
```bash
npm install rate-limiter-flexible
```

### Add SMS Queue
For large batches, use a queue system like Bull:
```bash
npm install bull
```

### Logging SMS History
Create a `sms_logs` table to track:
- Who received SMS
- When it was sent
- Delivery status
- Cost tracking

## Security Best Practices

1. **Never commit `.env`**: Add to `.gitignore`
2. **Rotate credentials**: Change AUTH_TOKEN periodically
3. **Use environment-specific numbers**: Different numbers for dev/staging/prod
4. **Monitor usage**: Set up Twilio alerts for unusual activity
5. **Validate phone numbers**: Use Twilio Lookup API to verify before sending

## Support Resources

- Twilio Documentation: https://www.twilio.com/docs
- Twilio Console: https://console.twilio.com
- Twilio Support: https://support.twilio.com
- Rate Limits: https://support.twilio.com/hc/en-us/articles/223183648

## Alternative: Email Notifications

If SMS costs are too high, consider email notifications:
```bash
npm install nodemailer
```

Then modify the notification logic to send emails instead of SMS.

---

**Questions?** Check the logs first, then consult Twilio documentation.
