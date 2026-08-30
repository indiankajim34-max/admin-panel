const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';
const otpStore = {};

app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'मोबाइल नंबर और कंट्री कोड आवश्यक हैं।' });
        }

        const fullNumber = countryCode + phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[fullNumber] = generatedOtp;

        const targetUrl = 'https://api.minimoth.dev/v1/otp/send';
        const response = await axios.post(targetUrl, {
            phone: fullNumber,
            otp: generatedOtp
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: 'WhatsApp OTP सफलतापूर्वक भेज दिया गया है!', data: response.data });
    } catch (error) {
        console.error('MiniMoth Send Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: `OTP भेजने में विफल: ${error.response?.data?.message || error.message}` });
    }
});

app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'मोबाइल नंबर, कंट्री कोड और ओटीपी सभी आवश्यक हैं।' });
        }

        const fullNumber = countryCode + phone;

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            delete otpStore[fullNumber];
            return res.status(200).json({ success: true, message: 'OTP सफलतापूर्वक सत्यापित हो गया है!' });
        }

        const targetUrl = 'https://api.minimoth.dev/v1/otp/verify';
        const response = await axios.post(targetUrl, {
            phone: fullNumber,
            otp: otp
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: 'OTP सफलतापूर्वक सत्यापित हो गया है!', data: response.data });
    } catch (error) {
        console.error('MiniMoth Verify Error:', error.response?.data || error.message);
        return res.status(400).json({ success: false, message: error.response?.data?.message || 'अमान्य या समाप्त हो चुका ओटीपी।' });
    }
});

app.listen(PORT, () => {
    console.log(`सुरक्षित बैकएंड सर्वर पोर्ट ${PORT} पर चल रहा है`);
});
