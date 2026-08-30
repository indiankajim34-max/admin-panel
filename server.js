<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>WinGo VIP - Ultimate Secure Dashboard</title>
<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore-compat.js"></script>
<style>
body { background: #0b0f19; color: #fff; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; }
.container { max-width: 500px; margin: auto; }
.card { background: #131a29; border: 1px solid #333; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
.input-group { margin-bottom: 12px; }
.input-group label { display: block; font-size: 13px; color: #aaa; margin-bottom: 5px; }
.input-group input, .input-group select { width: 100%; padding: 10px; background: #1e293b; border: 1px solid #334155; color: #fff; border-radius: 6px; box-sizing: border-box; }
button { width: 100%; padding: 10px; background: #00ff66; color: #0b0f19; border: none; font-weight: bold; border-radius: 6px; cursor: pointer; }
button:hover { opacity: 0.9; }
.settings-box { border: 1px solid #ffcc00; background: #181c24; padding: 15px; border-radius: 8px; margin-bottom: 15px; display: none; }
.copy-btn { background: #1e293b; color: #00ff66; border: 1px solid #00ff66; padding: 6px 10px; font-size: 12px; border-radius: 6px; cursor: pointer; margin-top: 6px; width: auto; display: inline-block; }
.header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.settings-icon { cursor: pointer; background: #1e293b; border: 1px solid #334155; padding: 8px 12px; border-radius: 8px; font-size: 16px; color: #ffcc00; }
.credit-badge { display: none; align-items: center; background: #1e293b; border: 1px solid #ffcc00; padding: 6px 10px; border-radius: 20px; font-size: 12px; color: #ffcc00; cursor: pointer; margin-right: 8px; }
.success { color: #00ff66; margin-top: 5px; font-size: 13px; }
.error { color: #ff4d4d; margin-top: 5px; font-size: 13px; }
.toggle-link { text-align: center; font-size: 13px; color: #0088cc; cursor: pointer; margin-top: 10px; }
.history-item { display: flex; justify-content: space-between; font-size: 12px; padding: 6px 0; border-bottom: 1px solid #222; }
</style>
</head>
<body>

<div class="container">
<!-- Login Form -->
<div id="loginFormContainer" class="card">
<h2 style="text-align: center; color: #00ff66; margin-bottom: 20px;">WinGo VIP Secure Portal</h2>
<div class="input-group">
<label>Username / ID</label>
<input type="text" id="loginUser" placeholder="Enter username">
</div>
<div class="input-group">
<label>Password</label>
<input type="password" id="loginPass" placeholder="Enter password">
</div>
<button onclick="handleLogin()">LOGIN</button>
<div id="loginMsg"></div>
<div class="toggle-link" onclick="switchView('register')">Don't have an account? Register</div>
<div class="toggle-link" onclick="switchView('forgot')">Forgot Password?</div>
</div>

<!-- Register Form -->
<div id="registerContainer" class="card" style="display: none;">
<h2 style="text-align: center; color: #00ff66; margin-bottom: 20px;">Register New Account</h2>
<div class="input-group">
<label>Username</label>
<input type="text" id="regUser" placeholder="Choose username">
</div>
<div class="input-group">
<label>Phone Number</label>
<input type="text" id="regPhone" placeholder="Enter phone number">
</div>
<div class="input-group">
<label>Password</label>
<input type="password" id="regPass" placeholder="Choose password">
</div>
<button onclick="handleRegister()">REGISTER</button>
<div id="regMsg"></div>
<div class="toggle-link" onclick="switchView('login')">Already have an account? Login</div>
</div>

<!-- Forgot Password Form -->
<div id="forgotContainer" class="card" style="display: none;">
<h2 style="text-align: center; color: #ffcc00; margin-bottom: 20px;">Reset Password</h2>
<div class="input-group">
<label>Username</label>
<input type="text" id="forgotUser" placeholder="Enter your username">
</div>
<div class="input-group">
<label>New Password</label>
<input type="password" id="forgotNewPass" placeholder="Enter new password">
</div>
<button onclick="handleResetPassword()">UPDATE PASSWORD</button>
<div id="forgotMsg"></div>
<div class="toggle-link" onclick="switchView('login')">Back to Login</div>
</div>

<!-- Dashboard Main View -->
<div id="dashboardContainer" style="display: none;">
<div class="header-flex">
<div style="display: flex; align-items: center;">
<div id="masterCreditBadge" class="credit-badge" onclick="openCreditModal()" title="Manage BharatPe UPI ID">💳 Credit</div>
<div>
<h3 id="welcomeHeader" style="margin: 0;">Welcome, <span id="dashUsername"></span></h3>
<p style="margin: 4px 0 0 0; font-size: 13px;">Role: <span id="dashRole" style="color: #00ff66; font-weight: bold;">Customer</span></p>
</div>
</div>
<div class="settings-icon" onclick="toggleSettingsPanel()" title="Settings & History">⚙️ Settings</div>
</div>

<!-- Settings & History Panel -->
<div id="resellerSettingsPanel" class="settings-box">
<h4 style="color: #ffcc00; margin-top: 0;" id="settingsPanelTitle">📊 My History & Stats</h4>
<div id="resellerPersonalView">
<p style="font-size: 12px; color: #aaa; margin: 0 0 10px 0;">Total Keys Purchased: <span id="resellerTotalKeysCount" style="color: #00ff66; font-weight: bold;">0</span></p>
<div style="max-height: 150px; overflow-y: auto; background: #131a29; padding: 8px; border-radius: 6px; border: 1px solid #333;" id="resellerHistoryList">
<p style="font-size: 12px; color: #777; text-align: center; margin: 5px 0;">No key purchase history recorded yet.</p>
</div>
</div>
<div id="masterGlobalView" style="display: none;">
<p style="font-size: 12px; color: #ffcc00; font-weight: bold; margin: 0 0 6px 0;">👑 Global Users, Resellers & Leaderboard:</p>
<div style="max-height: 220px; overflow-y: auto; background: #131a29; padding: 8px; border-radius: 6px; border: 1px solid #333;" id="masterGlobalList">
<p style="font-size: 12px; color: #777; text-align: center; margin: 5px 0;">Loading global system records...</p>
</div>
</div>
</div>

<!-- Summary Cards -->
<div class="card">
<p>Wallet Balance: ₹<span id="walletBalance" style="color: #00ff66; font-weight: bold;">0</span></p>
<p id="depositStatsRow">Today's Total Deposit: ₹<span id="totalDeposit" style="color: #ffcc00;">0</span></p>
<p>Today's Key Count: <span id="keyCount" style="color: #00ff66;">0</span></p>
</div>

<!-- Master Admin Panel -->
<div id="masterPanel" class="card" style="display: none; border-color: #ffcc00;">
<h4 style="color: #ffcc00; margin-top: 0;">👑 Master Control Panel</h4>
<div style="background: #131a29; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #333;">
<p style="color: #00ff66; font-size: 12px; margin: 0 0 6px 0; font-weight: bold;">Promote User to Reseller:</p>
<div class="input-group" style="margin-bottom: 8px;">
<input type="text" id="targetResellerUser" placeholder="Enter existing valid username">
</div>
<button onclick="promoteToReseller()" style="background: #0088cc; color: #fff; padding: 8px; font-size: 13px;">PROMOTE TO RESELLER</button>
<div id="promoteMsg" style="font-size: 12px; margin-top: 5px;"></div>
</div>

<div style="background: #131a29; padding: 10px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #333;">
<p style="color: #ff4d4d; font-size: 12px; margin: 0 0 6px 0; font-weight: bold;">Remove / Ban User:</p>
<div class="input-group" style="margin-bottom: 8px;">
<input type="text" id="banTargetUser" placeholder="Enter username to delete">
</div>
<button onclick="removeUserAccount()" style="background: #ff4d4d; color: #fff; padding: 8px; font-size: 13px;">DELETE / REMOVE USER</button>
<div id="banMsg" style="font-size: 12px; margin-top: 5px;"></div>
</div>

<div class="input-group">
<label>Custom Tag / Username Prefix</label>
<input type="text" id="masterCustomUsername" placeholder="e.g. Kajim_VIP">
</div>
<div class="input-group">
<label>Select Package / Custom Days</label>
<select id="masterPackageType">
<option value="1 Day VIP">1 Day VIP</option>
<option value="3 Days VIP">3 Days VIP</option>
<option value="7 Days VIP">7 Days VIP</option>
<option value="15 Days VIP">15 Days VIP</option>
<option value="20 Days VIP">20 Days VIP</option>
<option value="30 Days VIP">30 Days VIP</option>
<option value="Unlimited VIP">Unlimited VIP</option>
</select>
</div>
<button onclick="masterGenerateKey()" style="background: linear-gradient(135deg, #ffcc00, #ff9900); color: #000;">GENERATE CUSTOM KEY</button>
<div id="masterKeyBox" class="success" style="word-break: break-all; font-weight: bold; margin-top: 8px;"></div>
<button type="button" id="copyMasterKeyBtn" class="copy-btn" style="display:none;" onclick="copyTextToClipboard('masterKeyBox')">📋 Copy Key</button>
</div>

<!-- Single-Device Session Restriction & Reset -->
<div class="card">
<h4 style="color: #0088cc; margin-top: 0;">📱 Single-Device Session Lock</h4>
<p style="font-size: 12px; color: #aaa; margin: 0 0 8px 0;">A reseller ID can only remain logged in on one device at a time.</p>
<div class="input-group" style="margin-bottom: 8px;">
<input type="text" id="resetKeyInput" placeholder="Enter Key or Session ID">
</div>
<button onclick="resetDeviceBinding()" style="background: #0088cc; color: #fff; padding: 8px;">Reset Device Lock</button>
<div id="resetMsg"></div>
</div>

<!-- Game Server Key Generation -->
<div class="card">
<h4 style="color: #00ff66; margin-top: 0;">🔑 Game Server Key Generation</h4>
<div class="input-group">
<label>Select Package</label>
<select id="keyPackage" onchange="updateDynamicPricing()">
<option value="1 Day VIP">1 Day VIP (₹150)</option>
<option value="3 Days VIP">3 Days VIP (₹300)</option>
<option value="7 Days VIP">7 Days VIP (₹500)</option>
<option value="15 Days VIP">15 Days VIP (₹700)</option>
<option value="20 Days VIP">20 Days VIP (₹850)</option>
<option value="30 Days VIP">30 Days VIP (₹1250)</option>
<option value="Unlimited VIP">Unlimited VIP (₹3000)</option>
</select>
</div>
<p>Deduction Price: ₹<span id="displayPrice" style="color: #ffcc00; font-weight: bold;">150</span> <span id="priceTierLabel" style="font-size: 11px; color: #aaa;">(Customer Price)</span></p>
<button onclick="generateGameServerKey()">BUY & GENERATE KEY</button>
<div id="purchaseKeyBox" class="success" style="word-break: break-all; font-weight: bold; margin-top: 8px;"></div>
<button type="button" id="copyPurchaseKeyBtn" class="copy-btn" style="display:none;" onclick="copyTextToClipboard('purchaseKeyBox')">📋 Copy Key</button>
</div>

<!-- Deposit Section -->
<div class="card" id="depositSectionCard">
<h4 style="color: #00ff66; margin-top: 0;">💰 Deposit & UTR Verification</h4>
<div class="input-group">
<label>Deposit Amount (₹1000+ auto-upgrades to Reseller)</label>
<input type="number" id="depositAmount" placeholder="Enter amount (e.g. 1000)">
</div>
<button onclick="startSecureDeposit()" style="background: linear-gradient(135deg, #0088cc, #0044cc); color: #fff;">SUBMIT DEPOSIT</button>
</div>

<button onclick="handleLogout()" style="background: #ff4d4d; color: #fff; margin-top: 10px;">LOGOUT</button>
</div>
</div>

<!-- Credit / UPI Edit Modal -->
<div id="creditModal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:999; justify-content:center; align-items:center;">
<div style="background:#131a29; padding:20px; border-radius:10px; width:90%; max-width:400px; border:1px solid #ffcc00;">
<h3 style="color:#ffcc00; margin-top:0;">💳 Manage BharatPe UPI ID</h3>
<div class="input-group">
<label>Current Merchant UPI ID</label>
<input type="text" id="modalUpiInput" placeholder="e.g. merchant@unitype">
</div>
<button onclick="saveMasterUpiId()" style="background:#00ff66; color:#0b0f19; margin-bottom:8px;">UPDATE UPI ID</button>
<button onclick="closeCreditModal()" style="background:#334155; color:#fff;">CLOSE</button>
<div id="modalUpiMsg" style="font-size:12px; margin-top:8px;"></div>
</div>
</div>

<script>
const firebaseConfig = {
apiKey: "AIzaSyD-Secure-Production-Key",
authDomain: "wingo-vip-759b9.firebaseapp.com",
projectId: "wingo-vip-759b9",
storageBucket: "wingo-vip-759b9.appspot.com",
messagingSenderId: "1234567890",
appId: "1:1234567890:web:secure"
};

if (!firebase.apps.length) {
firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

let currentUser = null;
let currentRole = "Customer";
let userWallet = 0;
let todayDepositVal = 0;
let keyCountVal = 0;
let bharatPeMerchantVpa = "BHARATPE2G0B0C7V5V23545@unitype";

const basePricing = {
"1 Day VIP": 150,
"3 Days VIP": 300,
"7 Days VIP": 500,
"15 Days VIP": 700,
"20 Days VIP": 850,
"30 Days VIP": 1250,
"Unlimited VIP": 3000
};

db.collection("system_config").doc("payment_settings").get().then(doc => {
if(doc.exists && doc.data().upiId) {
bharatPeMerchantVpa = doc.data().upiId;
}
}).catch(err => console.log("Config load err:", err));

function openCreditModal() {
document.getElementById('modalUpiInput').value = bharatPeMerchantVpa;
document.getElementById('creditModal').style.display = 'flex';
}

function closeCreditModal() {
document.getElementById('creditModal').style.display = 'none';
document.getElementById('modalUpiMsg').innerText = '';
}

function saveMasterUpiId() {
const newUpi = document.getElementById('modalUpiInput').value.trim();
const msg = document.getElementById('modalUpiMsg');
if(!newUpi) {
msg.innerHTML = '<span class="error">UPI ID cannot be empty!</span>';
return;
}
db.collection("system_config").doc("payment_settings").set({
upiId: newUpi
}, { merge: true }).then(() => {
bharatPeMerchantVpa = newUpi;
msg.innerHTML = '<span class="success">✅ UPI ID updated successfully!</span>';
}).catch(err => {
msg.innerHTML = `<span class="error">Error: ${err.message}</span>`;
});
}

function switchView(view) {
document.getElementById('loginFormContainer').style.display = 'none';
document.getElementById('registerContainer').style.display = 'none';
document.getElementById('forgotContainer').style.display = 'none';
document.getElementById('dashboardContainer').style.display = 'none';

if(view === 'register') {
document.getElementById('registerContainer').style.display = 'block';
} else if(view === 'forgot') {
document.getElementById('forgotContainer').style.display = 'block';
} else if(view === 'dashboard') {
document.getElementById('dashboardContainer').style.display = 'block';
} else {
document.getElementById('loginFormContainer').style.display = 'block';
}
}

function toggleSettingsPanel() {
const panel = document.getElementById('resellerSettingsPanel');
if(panel.style.display === 'block') {
panel.style.display = 'none';
} else {
panel.style.display = 'block';
if(currentRole === "Master") {
document.getElementById('settingsPanelTitle').innerText = "👑 Master Global Panel & Leaderboard";
document.getElementById('resellerPersonalView').style.display = 'none';
document.getElementById('masterGlobalView').style.display = 'block';
loadMasterGlobalData();
} else {
document.getElementById('settingsPanelTitle').innerText = "📊 My Reseller History & Stats";
document.getElementById('masterGlobalView').style.display = 'none';
document.getElementById('resellerPersonalView').style.display = 'block';
loadResellerHistory();
}
}
}

function loadResellerHistory() {
db.collection("keys").where("createdBy", "==", currentUser).get().then((querySnapshot) => {
let historyHTML = "";
let count = 0;
querySnapshot.forEach((doc) => {
const d = doc.data();
count++;
historyHTML += `<div class="history-item"><span>🔑 ${d.key} (${d.package})</span><span style="color:#00ff66;">Active</span></div>`;
});
document.getElementById('resellerTotalKeysCount').innerText = count;
if(count > 0) {
document.getElementById('resellerHistoryList').innerHTML = historyHTML;
} else {
document.getElementById('resellerHistoryList').innerHTML = '<p style="font-size: 12px; color: #777; text-align: center; margin: 5px 0;">No key purchase history recorded yet.</p>';
}
}).catch((err) => {
console.log("Error loading keys history:", err);
});
}

function loadMasterGlobalData() {
Promise.all([
db.collection("users").get(),
db.collection("keys").get()
]).then(([userSnapshot, keySnapshot]) => {
let userStats = {};
userSnapshot.forEach(doc => {
let d = doc.data();
userStats[d.username] = {
role: d.role || "Customer",
wallet: d.wallet || 0,
totalDeposit: d.todayDeposit || 0,
keysCount: 0
};
});
keySnapshot.forEach(doc => {
let d = doc.data();
if(userStats[d.createdBy]) {
userStats[d.createdBy].keysCount++;
}
});
let html = "";
for(let uname in userStats) {
let u = userStats[uname];
html += `<div class="history-item"><span><b>${uname}</b> (${u.role}) - Wallet: ₹${u.wallet}</span><span style="color:#00ff66;">Keys: ${u.keysCount}</span></div>`;
}
document.getElementById('masterGlobalList').innerHTML = html || '<p style="font-size: 12px; color: #777; text-align: center;">No records found.</p>';
}).catch(err => {
console.log("Error loading master global data:", err);
});
}

function updateDynamicPricing() {
const pkg = document.getElementById('keyPackage').value;
let price = basePricing[pkg] || 150;
if(currentRole === "Reseller" || currentRole === "Master") {
price = Math.round(price * 0.4);
document.getElementById('priceTierLabel').innerText = "(Reseller 60% Discount Applied)";
} else {
document.getElementById('priceTierLabel').innerText = "(Customer Price)";
}
document.getElementById('displayPrice').innerText = price;
}

function handleRegister() {
const user = document.getElementById('regUser').value.trim();
const phone = document.getElementById('regPhone').value.trim();
const pass = document.getElementById('regPass').value.trim();
const msg = document.getElementById('regMsg');

if(!user || !phone || !pass) {
msg.innerHTML = '<span class="error">All fields are mandatory!</span>';
return;
}

db.collection("users").doc(user).get().then((doc) => {
if(doc.exists) {
msg.innerHTML = '<span class="error">Username already taken!</span>';
return;
}
db.collection("users").doc(user).set({
username: user,
password: pass,
phone: phone,
role: "Customer",
wallet: 0,
todayDeposit: 0,
todayKeys: 0,
createdAt: new Date()
}).then(() => {
msg.innerHTML = '<span class="success">Account created! Please login.</span>';
setTimeout(() => switchView('login'), 1500);
});
});
}

function handleResetPassword() {
const user = document.getElementById('forgotUser').value.trim();
const newPass = document.getElementById('forgotNewPass').value.trim();
const msg = document.getElementById('forgotMsg');

if(!user || !newPass) {
msg.innerHTML = '<span class="error">All fields are mandatory!</span>';
return;
}

db.collection("users").doc(user).get().then((doc) => {
if(!doc.exists) {
msg.innerHTML = '<span class="error">Username not found!</span>';
return;
}
db.collection("users").doc(user).update({
password: newPass
}).then(() => {
msg.innerHTML = '<span class="success">Password updated successfully! Please login.</span>';
setTimeout(() => switchView('login'), 1500);
});
});
}

function handleLogin() {
const user = document.getElementById('loginUser').value.trim();
const pass = document.getElementById('loginPass').value.trim();
const msg = document.getElementById('loginMsg');

if(!user || !pass) {
msg.innerHTML = '<span class="error">Enter username and password!</span>';
return;
}

db.collection("users").doc(user).get().then((doc) => {
if(!doc.exists) {
msg.innerHTML = '<span class="error">User not found! Register first.</span>';
return;
}
const data = doc.data();
if(data.password !== pass) {
msg.innerHTML = '<span class="error">Incorrect password!</span>';
return;
}

currentUser = user;
currentRole = data.role || "Customer";
userWallet = data.wallet || 0;
todayDepositVal = data.todayDeposit || 0;
keyCountVal = data.todayKeys || 0;
initDashboard();
}).catch(err => {
msg.innerHTML = `<span class="error">Login error: ${err.message}</span>`;
});
}

function initDashboard() {
switchView('dashboard');
document.getElementById('dashUsername').innerText = currentUser;
document.getElementById('dashRole').innerText = currentRole;
document.getElementById('walletBalance').innerText = userWallet;
document.getElementById('keyCount').innerText = keyCountVal;

if(currentRole === "Master") {
document.getElementById('masterPanel').style.display = 'block';
document.getElementById('masterCreditBadge').style.display = 'flex';
document.getElementById('depositSectionCard').style.display = 'none';
document.getElementById('depositStatsRow').style.display = 'none';
} else {
document.getElementById('masterPanel').style.display = 'none';
document.getElementById('masterCreditBadge').style.display = 'none';
document.getElementById('depositSectionCard').style.display = 'block';
document.getElementById('depositStatsRow').style.display = 'block';
document.getElementById('totalDeposit').innerText = todayDepositVal;
}
updateDynamicPricing();
}

// ----------------------------------------------------
// PERFECTED LICENSE KEY GENERATION SYSTEMS
// ----------------------------------------------------
function generateGameServerKey() {
const pkg = document.getElementById('keyPackage').value;
let price = basePricing[pkg] || 150;
if(currentRole === "Reseller" || currentRole === "Master") {
price = Math.round(price * 0.4);
}

if(userWallet < price) {
alert("Insufficient wallet balance! Please deposit funds.");
return;
}

userWallet -= price;
keyCountVal += 1;
document.getElementById('walletBalance').innerText = userWallet;
document.getElementById('keyCount').innerText = keyCountVal;

const randomNum = Math.floor(100000 + Math.random() * 900000);
const generatedKey = "WINGO-H-" + randomNum;

document.getElementById('purchaseKeyBox').innerText = generatedKey;
document.getElementById('copyPurchaseKeyBtn').style.display = 'inline-block';

db.collection("users").doc(currentUser).set({
wallet: userWallet,
todayKeys: keyCountVal
}, { merge: true });

db.collection("keys").doc(generatedKey).set({
key: generatedKey,
package: pkg,
createdBy: currentUser,
deviceId: "",
status: "active",
createdAt: new Date()
}).catch((err) => {
console.log("Error saving key to Firestore:", err);
});
}

function masterGenerateKey() {
const customPrefix = document.getElementById('masterCustomUsername').value.trim() || "WINGO-H";
const randomNum = Math.floor(100000 + Math.random() * 900000);
const generatedKey = `${customPrefix.toUpperCase()}-${randomNum}`;

document.getElementById('masterKeyBox').innerText = generatedKey;
document.getElementById('copyMasterKeyBtn').style.display = 'inline-block';

db.collection("keys").doc(generatedKey).set({
key: generatedKey,
package: document.getElementById('masterPackageType').value,
createdBy: currentUser,
deviceId: "",
status: "active",
createdAt: new Date()
}).catch((err) => {
console.log("Error saving master key to Firestore:", err);
});
}
// ----------------------------------------------------

function copyTextToClipboard(elementId) {
const text = document.getElementById(elementId).innerText;
navigator.clipboard.writeText(text).then(() => {
alert("Copied to clipboard!");
});
}

function startSecureDeposit() {
const amtInput = document.getElementById('depositAmount').value;
const amt = parseFloat(amtInput);
if(!amt || amt <= 0) {
alert("Please enter a valid deposit amount!");
return;
}

userWallet += amt;
todayDepositVal += amt;
if(currentRole === "Customer" && amt >= 1000) {
currentRole = "Reseller";
document.getElementById('dashRole').innerText = "Reseller (Upgraded)";
}

db.collection("users").doc(currentUser).update({
wallet: userWallet,
role: currentRole,
todayDeposit: todayDepositVal
}).then(() => {
document.getElementById('walletBalance').innerText = userWallet;
document.getElementById('totalDeposit').innerText = todayDepositVal;
alert("Deposit successful & wallet updated!");
document.getElementById('depositAmount').value = '';
}).catch(err => {
alert("Deposit error: " + err.message);
});
}

function promoteToReseller() {
const target = document.getElementById('targetResellerUser').value.trim();
const msg = document.getElementById('promoteMsg');
if(!target) {
msg.innerHTML = '<span class="error">Enter username!</span>';
return;
}
db.collection("users").doc(target).get().then((doc) => {
if(!doc.exists) {
msg.innerHTML = `<span class="error">❌ Invalid Username! User '${target}' does not exist.</span>`;
return;
}
db.collection("users").doc(target).set({ role: "Reseller" }, { merge: true }).then(() => {
msg.innerHTML = `<span class="success">✅ User '${target}' successfully promoted to Reseller!</span>`;
document.getElementById('targetResellerUser').value = '';
loadMasterGlobalData();
});
});
}

function removeUserAccount() {
const target = document.getElementById('banTargetUser').value.trim();
const msg = document.getElementById('banMsg');
if(!target) {
msg.innerHTML = '<span class="error">Enter username!</span>';
return;
}
db.collection("users").doc(target).delete().then(() => {
msg.innerHTML = `<span class="success">User ${target} deleted/removed.</span>`;
document.getElementById('banTargetUser').value = '';
});
}

function resetDeviceBinding() {
const keyText = document.getElementById('resetKeyInput').value.trim();
const msg = document.getElementById('resetMsg');
if(!keyText) {
msg.innerHTML = '<span class="error">Enter key to reset device!</span>';
return;
}
db.collection("keys").doc(keyText).get().then((doc) => {
if(!doc.exists) {
msg.innerHTML = '<span class="error">Key not found!</span>';
return;
}
doc.ref.update({ deviceId: "" }).then(() => {
msg.innerHTML = '<span class="success">Device lock successfully reset!</span>';
document.getElementById('resetKeyInput').value = '';
});
});
}

function handleLogout() {
currentUser = null;
currentRole = "Customer";
switchView('login');
document.getElementById('loginUser').value = '';
document.getElementById('loginPass').value = '';
document.getElementById('loginMsg').innerHTML = '';
document.getElementById('resellerSettingsPanel').style.display = 'none';
}
</script>
</body>
</html>
