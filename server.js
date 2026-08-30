const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const otpStore = {};
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

        const fullNumber = countryCode + phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[fullNumber] = generatedOtp;

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
            console.log('WhatsApp API failed, shifting to SMS fallback...');
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
            return res.status(200).json({ success: true, message: 'OTP successfully sent!', data: responseDetails });
        } else {
            return res.status(500).json({ success: false, message: 'Failed to send OTP, please try again.' });
        }

    } catch (err) {
        console.error('Server Error in send-otp:', err.message);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

app.post('/api/verify-otp', (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }

        const fullNumber = countryCode + phone;

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            delete otpStore[fullNumber];
            return res.status(200).json({ success: true, message: 'OTP verified successfully!' });
        }

        return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
