const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// MiniMoth API Key loaded securely from environment variables
const MINIMOTH_API_KEY = process.env.MINIMOTH_API_KEY;

// Secure OTP Send route communicating with MiniMoth backend API
app.post('/api/send-otp', async (req, res) => {
    const { phone, otp } = req.body;
    
    if (!phone || !otp) {
        return res.status(400).json({ success: false, error: "Phone number and OTP are required" });
    }

    if (!MINIMOTH_API_KEY) {
        return res.status(500).json({ success: false, error: "Server configuration error: API key missing on backend" });
    }

    try {
        const response = await fetch('https://api.minimoth.dev/v1/otp/send', {
            method: 'POST',
            headers: {
                'X-Api-Key': MINIMOTH_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                phone: phone,
                otp: otp
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || data.message || `API Error: ${response.status}`);
        }

        res.status(200).json({ success: true, message: "OTP sent successfully via WhatsApp!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
