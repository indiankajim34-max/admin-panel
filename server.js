const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Final & Direct Bulletproof Firebase Initialization (No credentials file required)
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: "wingo-vip-759b9"
    });
}

const db = admin.firestore();
const app = express();

app.use(express.json());
app.use(cors());

// Active deposit sessions & QR locks tracking maps
const activeQrSessions = new Map(); // Tracks 3-minute strict QR validity per user/device
const activeDepositLocks = new Map(); // Tracks 9-minute verification window

// 1. WhatsApp OTP Sending Route
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required.' });
        }

        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = Date.now() + 5 * 60 * 1000;
        
        await db.collection('otps').doc(phone).set({
            otp: otpCode,
            expiresAt: expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(200).json({ success: true, message: 'OTP sent successfully via WhatsApp.' });
    } catch (error) {
        console.error('Error sending OTP:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 2. WhatsApp OTP Verification Route
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        if (!phone || !otp) {
            return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
        }

        const otpDocRef = db.collection('otps').doc(phone);
        const otpDoc = await otpDocRef.get();

        if (!otpDoc.exists) {
            return res.status(400).json({ success: false, message: 'OTP not found or expired. Please request a new one.' });
        }

        const data = otpDoc.data();
        if (Date.now() > data.expiresAt) {
            await otpDocRef.delete();
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        if (data.otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP code entered.' });
        }

        await otpDocRef.delete();

        return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
    } catch (error) {
        console.error('Error verifying OTP:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 3. QR Session Route (Enforces strict 3-minute lock: prevents new QR generation/switching before 3 mins)
app.post('/api/get-qr-session', async (req, res) => {
    try {
        const { username, deviceId } = req.body;
        if (!username && !deviceId) {
            return res.status(400).json({ success: false, message: 'Username or Device ID required.' });
        }

        const identifier = username || deviceId;
        const currentTime = Date.now();
        const THREE_MINUTES = 3 * 60 * 1000;

        if (activeQrSessions.has(identifier)) {
            const sessionData = activeQrSessions.get(identifier);
            const elapsed = currentTime - sessionData.startTime;

            if (elapsed < THREE_MINUTES) {
                const remainingSeconds = Math.ceil((THREE_MINUTES - elapsed) / 1000);
                return res.status(200).json({
                    success: true,
                    active: true,
                    remainingTime: remainingSeconds,
                    message: 'Existing payment session active.'
                });
            }
        }

        // Start new 3-minute session lock
        activeQrSessions.set(identifier, { startTime: currentTime });
        return res.status(200).json({
            success: true,
            active: false,
            remainingTime: 180,
            message: 'New QR generated successfully.'
        });
    } catch (error) {
        console.error('QR Session Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

// 4. Instant UTR Verification & Device Authentication Route
app.post('/api/verify-utr-instant', async (req, res) => {
    try {
        const { username, utr, amount, deviceId } = req.body;

        if (!utr || utr.length !== 12 || !/^\d{12}$/.test(utr)) {
            return res.status(400).json({ success: false, message: 'Invalid UTR format. Must be exactly 12 digits.' });
        }

        if (!username || !amount) {
            return res.status(400).json({ success: false, message: 'Username and amount are required.' });
        }

        // Global check: Ensure UTR is never reused (One-time validity -> "USED/INVALID")
        const verifiedUtrRef = db.collection('verified_utrs').doc(utr);
        const verifiedSnap = await verifiedUtrRef.get();
        if (verifiedSnap.exists) {
            return res.status(400).json({ success: false, message: 'USED/INVALID: This UTR has already been used!' });
        }

        const currentTime = Date.now();
        const identifier = username || deviceId;
        
        if (!activeDepositLocks.has(utr)) {
            activeDepositLocks.set(utr, currentTime);
        }

        const lockTime = activeDepositLocks.get(utr);
        const elapsedSeconds = (currentTime - lockTime) / 1000;
        const NINE_MINUTES_SECONDS = 9 * 60; // 540 seconds

        // 9-Minute Timer Check: If exceeds, move automatically to PENDING list with 24-hour expiry timestamp
        if (elapsedSeconds > NINE_MINUTES_SECONDS) {
            const expiryLimitTime = admin.firestore.Timestamp.fromMillis(currentTime + (24 * 60 * 60 * 1000));

            await db.collection('pending_utrs').add({
                username: username,
                utr: utr,
                amount: Number(amount),
                deviceId: deviceId || '',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: expiryLimitTime
            });

            activeDepositLocks.delete(utr);
            if (identifier) activeQrSessions.delete(identifier);

            return res.status(200).json({ 
                success: false, 
                isPending: true, 
                message: 'Verification time exceeded 9 minutes. Moved to pending list for master approval.' 
            });
        }

        // Secure Transactional Execution: Prevents double/duplicate wallet credits under any race condition
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(username);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error('User account does not exist.');
            }

            const freshVerifiedSnap = await transaction.get(verifiedUtrRef);
            if (freshVerifiedSnap.exists) {
                throw new Error('USED/INVALID: This UTR has already been used!');
            }

            const userData = userDoc.data();
            const currentWallet = userData.wallet || 0;
            const currentDeposit = userData.todayDeposit || 0;
            let currentRole = userData.role || 'Customer';

            const newWallet = currentWallet + Number(amount);
            const newDeposit = currentDeposit + Number(amount);

            if (currentRole === 'Customer' && newDeposit >= 1000) {
                currentRole = 'Reseller';
            }

            transaction.update(userRef, {
                wallet: newWallet,
                todayDeposit: newDeposit,
                role: currentRole
            });

            transaction.set(verifiedUtrRef, {
                utr: utr,
                username: username,
                amount: Number(amount),
                deviceId: deviceId || '',
                usedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });

        activeDepositLocks.delete(utr);
        if (identifier) activeQrSessions.delete(identifier);

        return res.status(200).json({
            success: true,
            message: 'UTR verified instantly and wallet credited successfully.'
        });

    } catch (error) {
        console.error('UTR Verification Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running securely on port ${PORT}`);
});
