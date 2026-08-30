const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

// Initialize Firebase Admin for backend database operations (if service account is configured)
// To prevent crashes if service account keys aren't local, wrap in try-catch or init safely
try {
    if (!admin.apps.length) {
        // If you use environment variables or default config for backend Firestore writing
        admin.initializeApp({
            credential: admin.credential.applicationDefault()
        });
    }
} catch (e) {
    console.log("Firebase Admin initialization note: ", e.message);
}

const db = admin.apps.length ? admin.firestore() : null;

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
        return res.status(500).json({ message: 'Error during verification.' });
    }
});

// --- 100% BHARATPE EXCLUSIVE TELEGRAM WEBHOOK & FIREBASE SAVING LOGIC ---
app.post('/api/telegram-webhook', async (req, res) => {
    try {
        const update = req.body;
        
        if (update && update.message && update.message.text) {
            const text = update.message.text;
            const lowerText = text.toLowerCase();
            
            // Strict Filter: Only process if message strictly contains "bharatpe"
            if (lowerText.includes('bharatpe')) {
                
                // Extract 12-digit UTR
                const utrMatch = text.match(/\b\d{12}\b/);
                
                // Extract Amount (e.g. Rs.1000 or ₹1000)
                const amountMatch = text.match(/(?:Rs\.?|₹)\s*([\d,]+\.?\d*)/i);
                
                if (utrMatch) {
                    const utr = utrMatch[0];
                    let amount = 0;
                    
                    if (amountMatch && amountMatch[1]) {
                        amount = parseFloat(amountMatch[1].replace(/,/g, ''));
                    }

                    console.log(`Valid BharatPe SMS Caught! UTR: ${utr}, Amount: ${amount}`);
                    
                    // Save directly to Firebase Firestore sms_transactions collection for instant verification
                    if (db) {
                        await db.collection("sms_transactions").doc(utr).set({
                            utr: utr,
                            amount: amount,
                            rawMessage: text,
                            timestamp: new Date()
                        });
                        console.log(`Successfully saved UTR ${utr} to Firebase Firestore!`);
                    } else {
                        console.log("Firestore DB instance not initialized on backend, but UTR parsed successfully.");
                    }
                }
            }
        }
        
        return res.status(200).send({ success: true });
    } catch (err) {
        console.error('Webhook Processing Error:', err.message);
        return res.status(500).send({ success: false, error: err.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
