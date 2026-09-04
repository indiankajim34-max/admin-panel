const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { createWorker } = require('tesseract.js');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const apiKey = 'mm_live_09db69cf493a4391dcc1c8defd511432323e1c8c602f526f4f794ee956f95d0234c880e582aeb558351c92ded80d9edb';

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'screenshot-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

setInterval(() => {
    fs.readdir(uploadDir, (err, files) => {
        if (err) return;
        const now = Date.now();
        files.forEach(file => {
            const filePath = path.join(uploadDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) return;
                const hoursAgo = (now - stats.mtimeMs) / (1000 * 60 * 60);
                if (hoursAgo >= 3) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 15 * 60 * 1000);

app.get('/', (req, res) => {
    res.status(200).send('Kajim Digital Secure OTP Server is running perfectly.');
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
            return res.status(400).json({ message: 'Invalid OTP entered.' });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Error during verification.' });
    }
});

app.post('/api/verify-deposit-secure', upload.single('screenshot'), async (req, res) => {
    try {
        const { username, utr, lockedAmount, originalAmount, transactionTime } = req.body;
        const file = req.file;

        if (!username || !utr || !lockedAmount || !originalAmount || !file) {
            return res.status(400).json({ success: false, message: 'All fields including payment screenshot are required.' });
        }

        const cleanUtr = utr.toString().trim();
        const parsedLockedAmt = parseFloat(lockedAmount);

        if (isNaN(parsedLockedAmt) || parsedLockedAmt <= 0) {
            return res.status(400).json({ success: false, message: 'Invalid locked amount parameters.' });
        }

        const worker = await createWorker('eng');
        const ret = await worker.recognize(file.path);
        const extractedText = ret.data.text;
        await worker.terminate();

        const isUtrMatchedInImage = extractedText.includes(cleanUtr);
        const amountStr = parsedLockedAmt.toFixed(2);
        const altAmountStr = parsedLockedAmt.toString();
        const isAmountMatchedInImage = extractedText.includes(amountStr) || extractedText.includes(altAmountStr);

        let isTimeValid = true;
        if (transactionTime) {
            const lockTime = new Date(transactionTime).getTime();
            const currentTime = Date.now();
            const diffInMinutes = (currentTime - lockTime) / (1000 * 60);
            if (diffInMinutes > 4 || diffInMinutes < 0) {
                isTimeValid = false;
            }
        }

        const isStrictlyVerified = (isUtrMatchedInImage && isAmountMatchedInImage && isTimeValid);

        if (isStrictlyVerified) {
            return res.status(200).json({ 
                success: true, 
                verified: true, 
                message: 'Payment auto-verified successfully via OCR image scan!' 
            });
        } else {
            return res.status(200).json({ 
                success: true, 
                verified: false, 
                message: 'OCR Verification failed. Sent to manual review.' 
            });
        }
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Internal server error during OCR verification.' });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server successfully running on port ${PORT}`);
});
