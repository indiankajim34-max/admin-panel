const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 10000;
const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

// टेम्पोररी ओटीपी स्टोर करने के लिए
const otpStore = {};

// सर्वर हेल्थ चेक रूट
app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP Server is running perfectly.');
});

// 1. ओटीपी भेजने का एपीआई (रजिस्ट्रेशन और पासवर्ड चेंज दोनों के लिए)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'मोबाइल नंबर और कंट्री कोड दर्ज करना अनिवार्य है।' });
        }

        const fullNumber = countryCode + phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[fullNumber] = generatedOtp;

        let isSent = false;
        let responseDetails = null;

        // पहले व्हाट्सएप पर ओटीपी भेजने की कोशिश करें
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
            // अगर व्हाट्सएप फेल हो, तो तुरंत एसएमएस (SMS) के जरिए भेजें
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

        const fullNumber = countryCode + phone;

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            // वेरीफाई होने के बाद ओटीपी को हटा दें ताकि दोबारा इस्तेमाल न हो सके
            delete otpStore[fullNumber];
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
