const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

// Initialize Firebase Admin safely with fallback for Project ID to prevent environment detection errors
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id || "your-firebase-project-id" // Replace with your actual project ID if needed
    });
} catch (e) {
    // Fallback if serviceAccountKey.json is missing, explicitly setting projectId to avoid detection failure
    admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || "your-firebase-project-id" // <-- Yahan apna Firebase Project ID daal dein agar zaroorat ho
    });
}

const db = admin.firestore();
const app = express();

app.use(express.json());
app.use(cors());

// In-memory or tracking map for active deposit session locks (9-minute window)
const activeDepositLocks = new Map();

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

        console.log(`[WhatsApp OTP] Sending OTP ${otpCode} to ${phone}`);

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

// 3. Instant UTR Verification & Deposit Route
app.post('/api/verify-utr-instant', async (req, res) => {
    try {
        const { username, utr, amount, deviceId } = req.body;

        if (!utr || utr.length !== 12 || !/^\d{12}$/.test(utr)) {
            return res.status(400).json({ success: false, message: 'Invalid UTR format. Must be exactly 12 digits.' });
        }

        if (!username || !amount) {
            return res.status(400).json({ success: false, message: 'Username and amount are required.' });
        }

        // Check if UTR has already been used globally
        const verifiedUtrRef = db.collection('verified_utrs').doc(utr);
        const verifiedSnap = await verifiedUtrRef.get();
        if (verifiedSnap.exists) {
            return res.status(400).json({ success: false, message: 'This UTR has already been used and verified!' });
        }

        const currentTime = Date.now();
        
        if (!activeDepositLocks.has(utr)) {
            activeDepositLocks.set(utr, currentTime);
        }

        const lockTime = activeDepositLocks.get(utr);
        const elapsedSeconds = (currentTime - lockTime) / 1000;

        // If more than 9 minutes (540 seconds) have passed
        if (elapsedSeconds > 540) {
            await db.collection('pending_utrs').add({
                username: username,
                utr: utr,
                amount: Number(amount),
                deviceId: deviceId || '',
                status: 'pending',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            activeDepositLocks.delete(utr);

            return res.status(200).json({ 
                success: false, 
                isPending: true, 
                message: 'Payment verification time exceeded 9 minutes. Moved to pending list for master approval.' 
            });
        }

        // Perform transactional update
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(username);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error('User account does not exist.');
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
