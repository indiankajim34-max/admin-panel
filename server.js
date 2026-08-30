const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// अस्थायी मेमोरी में कंट्री कोड + फोन के साथ ओटीपी स्टोर करने के लिए
const otpStore = {};

// आपकी मिनीमोथ ऑफिशियल एपीआई की
const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

// सर्वर हेल्थ चेक रूट
app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP Server is running perfectly.');
});

// 1. ओटीपी भेजने का एपीआई (कंट्री कोड + फोन नंबर हैंडलिंग के साथ)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'मोबाइल नंबर और कंट्री कोड दर्ज करना अनिवार्य है।' });
        }

        // कंट्री कोड और फोन नंबर को एक साथ सही फॉर्मेट में जोड़ना
        const fullNumber = countryCode.trim() + phone.trim();
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[fullNumber] = generatedOtp;

        let isSent = false;
        let responseDetails = null;

        // पहले व्हाट्सएप पर भेजने की कोशिश करें
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
            console.log('WhatsApp API failed, shifting to SMS fallback...');
            // अगर व्हाट्सएप फेल हो, तो एसएमएस फॉलबैक के जरिए भेजें
            try {
                const smsRes = await axios.post('https://api.minimoth.dev/v1/sms/send', {
                    phone: fullNumber,
                    message: `Your verification code is: ${generatedOtp}`
                }, {
                    headers: {
                        'X-Api-Key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000
                });
                isSent = true;
                responseDetails = smsRes.data;
            } catch (smsErr) {
                console.error('SMS Fallback also failed:', smsErr.message);
            }
        }

        if (isSent) {
            return res.status(200).json({ success: true, message: 'ओटीपी सफलतापूर्वक भेज दिया गया है!', data: responseDetails });
        } else {
            return res.status(500).json({ success: false, message: 'ओटीपी भेजने में असमर्थ, कृपया पुनः प्रयास करें।' });
        }

    } catch (err) {
        console.error('Server Error in send-otp:', err.message);
        return res.status(500).json({ success: false, message: 'इंटरनल सर्वर त्रुटि।' });
    }
});

// 2. ओटीपी वेरिफाई करने का एपीआई
app.post('/api/verify-otp', (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'सभी जानकारी भरना आवश्यक है।' });
        }

        const fullNumber = countryCode.trim() + phone.trim();

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            delete otpStore[fullNumber]; // सुरक्षा के लिए इस्तेमाल के बाद डिलीट करें
            return res.status(200).json({ success: true, message: 'ओटीपी सफलतापूर्वक सत्यापित हो गया है!' });
        }

        return res.status(400).json({ success: false, message: 'गलत या एक्सपायर हो चुका ओटीपी।' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'सत्यापन के दौरान त्रुटि आई।' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`बैकएंड सर्वर सफलतापूर्वक पोर्ट ${PORT} पर चालू है`);
});
