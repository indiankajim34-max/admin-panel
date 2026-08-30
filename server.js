const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// सर्वर की रैम में अस्थायी रूप से OTP स्टोर करने के लिए मैप
const otpStorage = {};

// सुरक्षित व्हाट्सएप ओटीपी भेजने का एंडपॉइंट
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

        // मिनीमथ एपीआई के माध्यम से व्हाट्सएप ओटीपी भेजना
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

        // मेमोरी में OTP और 5 मिनट की एक्सपायरी सेव करें
        otpStorage[fullNumber] = {
            otp: generatedOtp,
            expiresAt: Date.now() + 5 * 60 * 1000
        };

        return res.status(200).json({ success: true, message: 'असली WhatsApp OTP सफलतापूर्वक भेज दिया गया है!' });
    } catch (error) {
        console.error('MiniMoth API Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: `OTP भेजने में विफल: ${error.message}` });
    }
});

// ओटीपी वेरिफ़िकेशन एंडपॉइंट
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        const fullNumber = countryCode + phone;

        const record = otpStorage[fullNumber];

        if (!record) {
            return res.status(400).json({ success: false, message: 'कृपया पहले ओटीपी अनुरोध करें।' });
        }

        if (Date.now() > record.expiresAt) {
            delete otpStorage[fullNumber];
            return res.status(400).json({ success: false, message: 'ओटीपी की समय सीमा समाप्त हो गई है।' });
        }

        if (record.otp !== otp) {
            return res.status(400).json({ success: false, message: 'गलत ओटीपी दर्ज किया गया है।' });
        }

        // वेरीफाई होने के बाद OTP डिलीट कर दें
        delete otpStorage[fullNumber];
        return res.status(200).json({ success: true, message: 'ओटीपी सफलतापूर्वक सत्यापित हो गया है।' });
    } catch (error) {
        console.error('Verify OTP Error:', error);
        return res.status(500).json({ success: false, message: `सत्यापन विफल: ${error.message}` });
    }
});

app.listen(PORT, () => {
    console.log(`सुरक्षित बैकएंड सर्वर पोर्ट ${PORT} पर चल रहा है।`);
});
