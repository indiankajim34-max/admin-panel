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
            const waRes = await axios.post('https://api.minimoth.dev/v1/otp/send', {
                phone: fullNumber
            }, {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            isSent = true;
            responseDetails = waRes.data;
        } catch (waErr) {
            console.log('Primary API failed, trying alternative endpoint...');
            try {
                const altRes = await axios.post('https://api.minimoth.dev/v1/send-otp', {
                    number: fullNumber
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });
                isSent = true;
                responseDetails = altRes.data;
            } catch (altErr) {
                console.error('All OTP endpoints failed:', altErr.response?.data || altErr.message);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to send OTP from provider.', 
                    error: altErr.response?.data || altErr.message 
                });
            }
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
                code: enteredOtp
            }, {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            isVerified = true;
            responseDetails = verifyRes.data;
        } catch (verifyErr) {
            console.log('Primary verify endpoint failed, trying alternative...');
            try {
                const altVerifyRes = await axios.post('https://api.minimoth.dev/v1/verify-otp', {
                    number: fullNumber,
                    code: enteredOtp
                }, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                });
                isVerified = true;
                responseDetails = altVerifyRes.data;
            } catch (altVerifyErr) {
                console.error('All verification endpoints failed:', altVerifyErr.response?.data || altVerifyErr.message);
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid OTP or verification failed.', 
                    error: altVerifyErr.response?.data || altVerifyErr.message 
                });
            }
        }

        if (isVerified) {
            return res.status(200).json({ success: true, message: 'OTP verified successfully!', data: responseDetails });
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
        
        console.log("Incoming SMS received:", smsBody);

        // Regex to extract 12-digit UTR (UPI Reference Number)
        const utrMatch = smsBody.match(/\b\d{12}\b/);
        // Regex to extract amount (e.g., Rs.3.0 or INR 3 or ₹3)
        const amountMatch = smsBody.match(/(?:Rs\.?|INR|₹)\s*([0-9]+(?:\.[0-9]+)?)/i);

        if (utrMatch && amountMatch) {
            const utr = utrMatch[0];
            const amount = parseFloat(amountMatch[1]);

            // Save the extracted SMS transaction into Firestore collection 'sms_transactions'
            if (db) {
                await db.collection("sms_transactions").doc(utr).set({
                    utr: utr,
                    amount: amount,
                    sender: sender || "BharatPe",
                    fullMessage: smsBody,
                    createdAt: new Date()
                });
            }

            console.log(`Saved SMS UTR: ${utr}, Amount: ${amount}`);
            return res.status(200).json({ success: true, message: 'SMS processed and saved successfully.' });
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
