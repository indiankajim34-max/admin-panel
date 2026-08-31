const express = require('express');
const firebaseAdmin = require('firebase-admin');

// Initialize Firebase Admin with your existing project config securely
if (!firebaseAdmin.apps.length) {
    firebaseAdmin.initializeApp({
        projectId: "wingo-vip-759b9"
    });
}
const db = firebaseAdmin.firestore();
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP Server is running perfectly.');
});

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

// ==========================================
// DIRECT FIREBASE PAYMENT WEBHOOK & VERIFICATION
// ==========================================

app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const message = req.body.message || req.body.edited_message;
        if (message && message.text) {
            const text = message.text;
            
            const utrMatch = text.match(/\b\d{12}\b/);
            const amountMatch = text.match(/Rs\.?\s*([\d\.]+)/i) || text.match(/INR\s*([\d\.]+)/i);

            if (utrMatch) {
                const utr = utrMatch[0];
                const amount = amountMatch ? amountMatch[1] : '0';

                // Save directly to Firebase Firestore collections securely using Admin SDK
                await db.collection('payments').doc(utr).set({
                    utr: utr,
                    amount: amount,
                    rawText: text,
                    createdAt: Date.now()
                });
                console.log(`Payment saved to Firebase for UTR: ${utr}`);
            }
        }
        res.status(200).send('OK');
    } catch (error) {
        console.error('Firebase Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/api/verify-payment/:utr', async (req, res) => {
    try {
        const utr = req.params.utr;
        const docRef = db.collection('payments').doc(utr);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            return res.status(200).json({ success: true, data: docSnap.data() });
        }
        return res.status(404).json({ success: false, message: 'Payment not found' });
    } catch (error) {
        console.error('Verification Error:', error);
        return res.status(500).json({ success: false, message: 'Error verifying payment' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
