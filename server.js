const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

// ==========================================
// 1. ORIGINAL SECURE OTP SYSTEM (MINIMOTH API)
// ==========================================

app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP & Payment Server is running perfectly.');
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
        return res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});


// ==========================================
// 2. PAYMENT VERIFICATION SYSTEM (MACRODROID WEBHOOK)
// ==========================================

let receivedPayments = [];

app.post('/api/webhook/sms', (req, res) => {
    try {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ success: false, message: 'Message missing' });
        }

        let utrMatch = message.match(/(?:UTR|Ref|UPI Ref|Txn No)[:\s]*([0-9]{12})/i) || message.match(/\b\d{12}\b/);
        let amountMatch = message.match(/Rs\.?\s*([0-9]+(?:\.[0-9]+)?)/i);

        let utr = utrMatch ? (utrMatch[1] || utrMatch[0]) : null;
        let amount = amountMatch ? amountMatch[1] : null;

        if (utr) {
            receivedPayments.push({
                utr: utr.trim(),
                amount: amount ? amount.trim() : '0',
                message: message,
                time: new Date()
            });
            console.log('Payment Saved Successfully:', { utr, amount });
            return res.status(200).json({ success: true, message: 'SMS saved successfully' });
        } else {
            receivedPayments.push({
                utr: 'UNKNOWN',
                amount: amount ? amount.trim() : '0',
                message: message,
                time: new Date()
            });
            return res.status(200).json({ success: true, message: 'Saved without UTR' });
        }
    } catch (err) {
        console.error('Webhook Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/verify-payment', (req, res) => {
    try {
        const { utr } = req.body;
        if (!utr) {
            return res.status(400).json({ success: false, message: 'UTR is required' });
        }

        const foundPayment = receivedPayments.find(p => p.utr === utr.trim());

        if (foundPayment) {
            return res.status(200).json({ 
                success: true, 
                message: 'Payment verified successfully!', 
                data: foundPayment 
            });
        } else {
            return res.status(404).json({ 
                success: false, 
                message: 'Payment not found! No SMS received for this UTR.' 
            });
        }
    } catch (err) {
        console.error('Verify Payment Error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
