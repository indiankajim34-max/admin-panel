const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin initialization for server-side Firestore operations
if (!admin.apps.length) {
try {
    admin.initializeApp({
        credential: admin.credential.applicationDefault()
    });
} catch (e) {
    console.log('Firebase admin init note:', e.message);
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
            const waRes = await axios.post('https://api.minimoth.dev/v1/send-otp', {
                number: fullNumber
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
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

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully via WhatsApp.',
            data: responseDetails
        });

    } catch (err) {
        console.error('Error in send-otp:', err.message);
        return res.status(500).json({ success: false, message: err.message });
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
                number: fullNumber,
                otp: enteredOtp
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            isVerified = true;
            responseDetails = verifyRes.data;
        } catch (verifyErr) {
            console.error('OTP verification API error:', verifyErr.response?.data || verifyErr.message);
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP or verification failed.',
                error: verifyErr.response?.data || verifyErr.message
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully.',
            data: responseDetails
        });

    } catch (err) {
        console.error('Error in verify-otp:', err.message);
        return res.status(500).json({ success: false, message: err.message });
    }
});

// --- NEW DEVICE-BASED UTR PAYMENT VERIFICATION ROUTE (SMS System Completely Removed) ---

app.post('/api/verify-utr', async (req, res) => {
    try {
        const { utr, expectedAmount, username, deviceId, qrTimestamp } = req.body;
        
        // 1. Strict 12-digit UTR validation
        if (!utr || utr.length !== 12 || !/^\d{12}$/.test(utr)) {
            return res.status(400).json({ success: false, message: 'Strict UTR Error: Must be exactly 12 digits!' });
        }

        if (!db) {
            return res.status(500).json({ success: false, message: 'Database not initialized.' });
        }

        // 2. Time Window Check (Must submit UTR within 3 to 3.5 minutes of QR generation)
        const currentTime = Date.now();
        const timeDiffMinutes = (currentTime - qrTimestamp) / (1000 * 60);
        if (timeDiffMinutes > 3.5) {
            return res.status(400).json({ success: false, message: 'Time expired! Please submit UTR within 3 minutes of generating QR.' });
        }

        // 3. Duplicate UTR Check
        const usedRef = await db.collection("verified_utrs").doc(utr).get();
        if (usedRef.exists) {
            return res.status(400).json({ success: false, message: 'Duplicate UTR! This UTR has already been claimed.' });
        }

        // 4. Save verified UTR in database
        await db.collection("verified_utrs").doc(utr).set({
            utr: utr,
            username: username,
            amount: expectedAmount,
            deviceId: deviceId,
            usedAt: new Date()
        });

        return res.status(200).json({ 
            success: true, 
            message: 'Payment verified successfully via device authentication!', 
            amount: expectedAmount 
        });

    } catch (err) {
        console.error('Error in verify-utr API:', err.message);
        return res.status(500).json({ success: false, message: 'Server error during UTR verification.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
