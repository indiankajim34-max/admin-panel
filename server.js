const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin initialization for server-side Firestore operations (if configured)
if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    } catch (e) {
        // Fallback or lightweight initialization if needed
    }
}

const db = admin.apps.length ? admin.firestore() : null;
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP & Payment Server is running perfectly.');
});

// --- ORIGINAL OTP SYSTEM (Untouched & Safe) ---
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required.' });
        }

        const fullNumber = phone.toString().trim();
        let isSent = false;
        let responseDetails = null;

        try {
            const otpRes = await axios.post('https://api.minimoth.dev/v1/otp/send', {
                phone: fullNumber
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            responseDetails = otpRes.data;
            isSent = true;
        } catch (apiErr) {
            console.error('Minimoth API send-otp error:', apiErr.response?.data || apiErr.message);
        }

        if (isSent) {
            return res.status(200).json({ success: true, message: 'OTP successfully sent!', data: responseDetails });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP, please try again.' });
        }
    } catch (err) {
        console.error('Server Error in send-otp:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
        }

        const fullNumber = phone.toString().trim();
        const enteredOtp = otp.toString().trim();
        let isVerified = false;
        let responseDetails = null;

        try {
            const verifyRes = await axios.post('https://api.minimoth.dev/v1/otp/verify', {
                phone: fullNumber,
                otp: enteredOtp
            }, {
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                timeout: 10000
            });
            responseDetails = verifyRes.data;
            isVerified = true;
        } catch (apiErr) {
            console.error('Minimoth API verify-otp error:', apiErr.response?.data || apiErr.message);
        }

        if (isVerified) {
            return res.status(200).json({ success: true, message: 'OTP verified successfully.', data: responseDetails });
        } else {
            return res.status(400).json({ success: false, message: 'Invalid OTP entered.' });
        }
    } catch (err) {
        console.error('Server Error in verify-otp:', err.message);
        return res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});

// --- AUTOMATIC SMS PAYMENT VERIFICATION ROUTE ---
app.post('/api/incoming-sms', async (req, res) => {
    try {
        const { sender, message, text } = req.body;
        const smsBody = message || text || "";
        
        if (!smsBody) {
            console.log("Incoming SMS received but message body is empty.");
            return res.status(400).json({ success: false, message: 'Message content is required.' });
        }

        console.log(`Incoming SMS received: Sender: ${sender || 'Unknown'}, Message: ${smsBody}`);

        let utr = null;
        let amount = null;

        // मजबूत UTR पैटर्न (12-digit UPI reference / UTR / RRN / Ref no)
        const utrPatterns = [
            /(?:UTR|upi[-:\s]*ref[-:\s*number]*|reference|ref\s*no|ref|txn|transaction|rrn)[-:\s]*([0-9]{12})/i,
            /\b([0-9]{12})\b/
        ];

        for (let pattern of utrPatterns) {
            const match = smsBody.match(pattern);
            if (match && match[1]) {
                utr = match[1];
                break;
            }
        }

        // मजबूत Amount पैटर्न (Rs, INR, ₹ के बाद या credited/received के पास की संख्या)
        const amountPatterns = [
            /(?:Rs\.?|INR|₹)\s*([0-9,]+(?:\.[0-9]{1,2})?)/i,
            /(?:credited|received|paid|by)\s*(?:rs\.?|inr|₹)?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i
        ];

        for (let pattern of amountPatterns) {
            const match = smsBody.match(pattern);
            if (match && match[1]) {
                const parsedAmt = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(parsedAmt) && parsedAmt > 0) {
                    amount = parsedAmt;
                    break;
                }
            }
        }

        if (utr && amount) {
            console.log(`Successfully Extracted -> UTR: ${utr}, Amount: ${amount}`);

            if (!db) {
                console.error('Firestore DB not initialized on server.');
                return res.status(500).json({ success: false, message: 'Database not initialized.' });
            }

            // sms_transactions कलेक्शन में UTR सेव करें ताकि frontend इसे वैलिडेट कर सके
            await db.collection("sms_transactions").doc(utr).set({
                utr: utr,
                amount: amount,
                sender: sender || "BharatPe/Bank",
                fullMessage: smsBody,
                createdAt: new Date()
            });

            console.log(`Saved SMS UTR: ${utr}, Amount: ${amount}`);
            return res.status(200).json({ success: true, message: 'SMS processed and saved successfully.', utr, amount });
        } else {
            console.log("SMS received but UTR or Amount not found in text.");
            return res.status(400).json({ success: false, message: 'UTR or Amount not found in SMS.' });
        }
    } catch (err) {
        console.error('Error processing incoming SMS:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
