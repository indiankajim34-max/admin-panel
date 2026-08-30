const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// MiniMoth API Key set kar di hai
const MINIMOTH_API_KEY = "mm_live_09db69cf493a4391dcc1c8efd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb";

// OTP Send karne ka route
app.post('/api/send-otp', async (req, res) => {
    const { phone } = req.body;
    
    try {
        // Yahan MiniMoth ka request code aayega
        res.status(200).json({ success: true, message: "OTP sent successfully!" });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
