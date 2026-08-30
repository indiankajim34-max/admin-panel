const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// MiniMoth Live API Credentials (सुरक्षित रूप से बैकएंड में)
const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

const otpStore = {};

// 1. Send OTP Endpoint
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'Phone number and country code are required.' });
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

        return res.status(200).json({ success: true, message: 'WhatsApp OTP sent successfully via MiniMoth!', data: response.data });
    } catch (error) {
        console.error('MiniMoth Send Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: `Failed to send OTP: ${error.response?.data?.message || error.message}` });
    }
});

// 2. Verify OTP Endpoint
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'Phone, country code and OTP are required.' });
        }

        const fullNumber = countryCode + phone;

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            delete otpStore[fullNumber];
            return res.status(200).json({ success: true, message: 'OTP verified successfully!' });
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

        return res.status(200).json({ success: true, message: 'OTP verified successfully!', data: response.data });
    } catch (error) {
        console.error('MiniMoth Verify Error:', error.response?.data || error.message);
        return res.status(400).json({ success: false, message: error.response?.data?.message || 'Invalid or expired OTP.' });
    }
});

app.listen(PORT, () => {
    console.log(`Secure backend server running on port ${PORT}`);
});
