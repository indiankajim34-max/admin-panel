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

// ओटीपी भेजने का मुख्य बैकएंड एंडपॉइंट (WhatsApp + SMS Fallback)
app.post('/api/send-otp', async (req, res) => {
    try {
        const { phone, countryCode } = req.body;
        if (!phone || !countryCode) {
            return res.status(400).json({ success: false, message: 'मोबाइल नंबर और कंट्री कोड आवश्यक हैं।' });
        }

        const fullNumber = countryCode + phone;
        const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[fullNumber] = generatedOtp;

        let successSent = false;
        let apiResponse = null;

        // पहले WhatsApp पर ओटीपी भेजने का प्रयास
        try {
            const waResponse = await axios.post('https://api.minimoth.dev/v1/otp/send', {
                phone: fullNumber,
                otp: generatedOtp
            }, {
                headers: {
                    'X-Api-Key': apiKey,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            successSent = true;
            apiResponse = waResponse.data;
        } catch (waError) {
            console.log('WhatsApp OTP Failed, switching to SMS fallback...', waError.message);
            
            // व्हाट्सएप फेल होने पर SMS फॉलबैक का प्रयास
            try {
                const smsResponse = await axios.post('https://api.minimoth.dev/v1/sms/send', {
                    phone: fullNumber,
                    message: `Your verification code is: ${generatedOtp}`
                }, {
                    headers: {
                        'X-Api-Key': apiKey,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    }
                });
                successSent = true;
                apiResponse = smsResponse.data;
            } catch (smsError) {
                console.error('SMS Fallback also failed:', smsError.response?.data || smsError.message);
            }
        }

        if (successSent) {
            return res.status(200).json({ success: true, message: 'ओटीपी सफलताપૂર્વक भेज दिया गया है!', data: apiResponse });
        } else {
            return res.status(500).json({ success: false, message: 'WhatsApp और SMS दोनों के माध्यम से ओटीपी भेजने में विफलता।' });
        }

    } catch (error) {
        console.error('Server Error:', error.message);
        return res.status(500).json({ success: false, message: 'इंटरनल सर्वर एरर।' });
    }
});

// ओटीपी वेरिफ़िकेशन एंडपॉइंट
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { phone, countryCode, otp } = req.body;
        if (!phone || !countryCode || !otp) {
            return res.status(400).json({ success: false, message: 'सभी फील्ड आवश्यक हैं।' });
        }

        const fullNumber = countryCode + phone;

        if (otpStore[fullNumber] && otpStore[fullNumber] === otp) {
            delete otpStore[fullNumber];
            return res.status(200).json({ success: true, message: 'OTP सफलतापूर्वक सत्यापित हो गया है!' });
        }

        return res.status(400).json({ success: false, message: 'अमान्य या समाप्त हो चुका ओटीपी।' });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'वेरिफ़िकेशन के दौरान त्रुटि।' });
    }
});

app.listen(PORT, () => {
    console.log(`सुरक्षित बैकएंड सर्वर पोर्ट ${PORT} पर चल रहा है`);
});
