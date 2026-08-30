const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const admin = require('firebase-admin');

// Firebase Admin SDK इनिशियलाइज करें (Firestore में OTP सेव करने के लिए)
// ध्यान दें: सुनिश्चित करें कि आपके Render Environment Variables में FIREBASE_SERVICE_ACCOUNT या आपका क्रेडेंशियल सेट है, 
// या सीधे आपके Firestore प्रोजेक्ट कॉन्फिग के साथ इनिशियलाइज किया गया है।
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault() // या अपना प्रोजेक्ट क्रेडेंशियल यहाँ जोड़ें
    });
}
const db = admin.firestore();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// सुरक्षित व्हाट्सएप/एसएमएस ओटीपी भेजने का एंडपॉइंट (अब Firestore में स्टोर होगा ताकि रीसेट न हो)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode, context } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'फ़ोन नंबर और देश कोड आवश्यक हैं।' });
        }

        const fullNumber = countryCode + phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // मिनीमथ (MiniMoth) लाइव एपीआई क्रेडेंशियल्स
        const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';
        const targetUrl = 'https://api.minimoth.dev/v1/otp/send';

        // मिनीमथ एपीआई के माध्यम से असली व्हाट्सएप ओटीपी भेजना
        await axios.post(targetUrl, {
            phone: fullNumber,
            otp: generatedOtp
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        // सत्यापन के लिए ओटीपी को Firestore डेटाबेस में सुरक्षित रूप से स्टोर करें (5 मिनट की समय सीमा)
        await db.collection('server_otps').doc(fullNumber).set({
            otp: generatedOtp,
            expiresAt: Date.now() + 5 * 60 * 1000
        });

        return res.status(200).json({ success: true, message: 'असली WhatsApp OTP सफलतापूर्वक भेज दिया गया है!' });
    } catch (error) {
        console.error('MiniMoth API Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: `OTP भेजने में विफल: ${error.message}` });
    }
});

// ओटीपी वेरिफ़िकेशन एंडपॉइंट (Firestore डेटाबेस से वेरीफाई करेगा)
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        const fullNumber = countryCode + phone;

        const docRef = db.collection('server_otps').doc(fullNumber);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            return res.status(400).json({ success: false, message: 'कृपया पहले ओटीपी अनुरोध करें।' });
        }

        const record = docSnap.data();

        if (Date.now() > record.expiresAt) {
            await docRef.delete();
            return res.status(400).json({ success: false, message: 'ओटीपी की समय सीमा समाप्त हो गई है।' });
        }

        if (record.otp !== otp) {
            return res.status(400).json({ success: false, message: 'गलत ओटीपी दर्ज किया गया है।' });
        }

        // सफलतापूर्वक वेरीफाई होने के बाद ओटीपी को डिलीट कर दें ताकि दोबारा इस्तेमाल न हो सके
        await docRef.delete();
        return res.status(200).json({ success: true, message: 'ओटीपी सफलतापूर्वक सत्यापित हो गया है।' });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({ success: false, message: `सत्यापन विफल: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`सुरक्षित बैकएंड सर्वर पोर्ट ${PORT} पर चल रहा है।`);
});
