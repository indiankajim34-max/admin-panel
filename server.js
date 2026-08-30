const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// MiniMoth Live API Credentials
const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

// 1. Send OTP Endpoint (MiniMoth generates and sends the real WhatsApp OTP)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'Phone number and country code are required.' });
        }

        const fullNumber = countryCode + phone;
        const targetUrl = 'https://api.minimoth.dev/v1/otp/send';

        // Calling MiniMoth to send the OTP via WhatsApp
        const response = await axios.post(targetUrl, {
            phone: fullNumber
        }, {
            headers: {
                'X-Api-Key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        return res.status(200).json({ success: true, message: 'WhatsApp OTP sent successfully!', data: response.data });
    } catch (error) {
        console.error('MiniMoth Send Error:', error.response?.data || error.message);
        return res.status(500).json({ success: false, message: `Failed to send OTP: ${error.response?.data?.message || error.message}` });
    }
});

// 2. Verify OTP Endpoint (MiniMoth verifies the OTP)
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'Phone, country code and OTP are required.' });
        }

        const fullNumber = countryCode + phone;
        const targetUrl = 'https://api.minimoth.dev/v1/otp/verify';

        // Calling MiniMoth to verify the OTP entered by user
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
