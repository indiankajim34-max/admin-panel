const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin initialization (using your project credentials or default config)
admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "wingo-vip-759b9"
});
const db = admin.firestore();

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
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'Phone number and country code are required.' });
        }

        const cleanPhone = phone.toString().trim();
        const cleanCountryCode = countryCode.toString().trim();
        const fullNumber = cleanCountryCode + cleanPhone;
        
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP to Firestore database to prevent loss on server sleep/restart
        await db.collection('server_otps').doc(fullNumber).set({
            otp: generatedOtp,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        let isSent = false;
        let responseDetails = null;

        try {
            const waRes = await axios.post('https://api.minimoth.dev/v1/otp/send', {
                phone: fullNumber,
                otp: generatedOtp
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
            console.log('WhatsApp API failed, trying alternative endpoint...');
            try {
                const altRes = await axios.post('https://api.minimoth.dev/v1/send-otp', {
                    number: fullNumber,
                    otp: generatedOtp
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
                console.error('All OTP endpoints failed:', altErr.message);
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
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const cleanPhone = phone.toString().trim();
        const cleanCountryCode = countryCode.toString().trim();
        const fullNumber = cleanCountryCode + cleanPhone;
        const enteredOtp = otp.toString().trim();

        const docRef = db.collection('server_otps').doc(fullNumber);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(400).json({ success: false, message: 'No active OTP found. Please request a new OTP.' });
        }

        const record = docSnap.data();

        if (Date.now() > record.expiresAt) {
            await docRef.delete();
            return res.status(400).json({ success: false, message: 'OTP has expired! Please request a new one.' });
        }

        if (record.otp === enteredOtp) {
            await docRef.delete(); // Delete after successful verification
            return res.status(200).json({ success: true, message: 'OTP verified successfully!' });
        }

        return res.status(400).json({ success: false, message: 'Invalid OTP entered. Please check and try again.' });
    } catch (err) {
        console.error('Server Error in verify-otp:', err.message);
        return res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
