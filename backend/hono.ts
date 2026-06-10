import 'dotenv/config';

import { trpcServer } from '@hono/trpc-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import mongoose from 'mongoose';

import { appRouter } from './trpc/app-router';
import { createContext } from './trpc/create-context';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { Contribution } from './models/Contribution';
import { User } from './models/User';

const app = new Hono();

app.use('*', cors());

// Health Check endpoint to support external keep-alive pingers (like UptimeRobot)
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date() }));

// Play Store Required Privacy Policy page
app.get('/privacy', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hubmate Privacy Policy</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Outfit', sans-serif; background-color: #faf7f2; }
      </style>
    </head>
    <body class="py-10 px-4 md:px-8 max-w-3xl mx-auto text-slate-800">
      <div class="bg-white rounded-3xl p-8 shadow-sm border border-stone-200/50">
        <h1 class="text-3xl font-bold text-[#721c3b] mb-2">Hubmate Privacy Policy</h1>
        <p class="text-slate-400 text-xs mb-6">Last updated: June 10, 2026</p>
        
        <p class="mb-4 text-sm leading-relaxed">Welcome to Hubmate. We value your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, and safe-keep your information when you use our mobile application.</p>
        
        <h2 class="text-xl font-bold text-slate-900 mt-6 mb-3">1. Information We Collect</h2>
        <p class="mb-3 text-sm leading-relaxed">To provide our roommate coordination features, we collect:</p>
        <ul class="list-disc pl-5 mb-4 text-sm space-y-1.5">
          <li><strong>Profile Data:</strong> Name, email address, and phone number when you register.</li>
          <li><strong>Household Data:</strong> Chores logs, uploaded proof images (stored in Cloudinary), notice board announcements, and group chat messages.</li>
          <li><strong>Transaction Data:</strong> Payment details related to bill splitting (integrated with Razorpay). We do not store credit card or bank details on our servers.</li>
        </ul>
        
        <h2 class="text-xl font-bold text-slate-900 mt-6 mb-3">2. How We Use Your Information</h2>
        <p class="mb-4 text-sm leading-relaxed">We use your information to operate and maintain your household group, verify chore completions, securely manage shared bill splits, and facilitate in-app notifications and chats between room members.</p>
        
        <h2 class="text-xl font-bold text-slate-900 mt-6 mb-3">3. Data Sharing & Security</h2>
        <p class="mb-4 text-sm leading-relaxed">Your data is only shared with the roommates in your designated room group. We do not sell or share your personal data with third-party advertisers. All passwords and network requests are encrypted using industry-standard protocols.</p>
        
        <h2 class="text-xl font-bold text-slate-900 mt-6 mb-3">4. Contact Us</h2>
        <p class="mb-4 text-sm leading-relaxed">If you have any questions or request deletion of your account and personal data, please contact the roommate administrator of your group or email us at rajb81008@gmail.com.</p>
        
        <div class="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
          <span>&copy; 2026 Hubmate App</span>
          <a href="/" class="text-[#721c3b] font-bold">Home</a>
        </div>
      </div>
    </body>
    </html>
  `);
});


const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

let razorpay: Razorpay | null = null;
if (razorpayKeyId && razorpayKeySecret) {
  try {
    razorpay = new Razorpay({
      key_id: razorpayKeyId,
      key_secret: razorpayKeySecret,
    });
  } catch (error) {
    console.error('Error initializing Razorpay:', error);
  }
}

// Payment Verification API
app.post('/pay/verify', async (c) => {
  try {
    const body = await c.req.json();
    const { contributionId, userId, razorpayPaymentId, razorpayOrderId, razorpaySignature } = body;

    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return c.json({ success: false, message: 'Contribution not found' }, 404);
    }

    const userSplit = contribution.splits.find(
      (split: any) => split.userId.toString() === userId
    );

    if (!userSplit) {
      return c.json({ success: false, message: 'You are not included in this split' }, 400);
    }

    // Verification Logic
    let isVerified = false;

    if (
      razorpayOrderId.startsWith('order_mock_') ||
      (razorpayPaymentId.startsWith('pay_mock_') && (!razorpayKeyId || razorpayKeyId.startsWith('rzp_test_')))
    ) {
      isVerified = true;
    } else if (razorpayKeySecret && razorpaySignature) {
      const text = razorpayOrderId + '|' + razorpayPaymentId;
      const generatedSignature = crypto
        .createHmac('sha256', razorpayKeySecret)
        .update(text)
        .digest('hex');

      isVerified = generatedSignature === razorpaySignature;
    }

    if (!isVerified) {
      return c.json({ success: false, message: 'Payment verification failed. Invalid signature.' }, 400);
    }

    userSplit.status = 'paid';
    userSplit.razorpayPaymentId = razorpayPaymentId;
    userSplit.razorpayOrderId = razorpayOrderId;
    await contribution.save();

    return c.json({ success: true });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return c.json({ success: false, message: err.message }, 500);
  }
});

// Checkout Webpage Portal
app.get('/pay/:contributionId/:userId', async (c) => {
  const contributionId = c.req.param('contributionId');
  const userId = c.req.param('userId');

  try {
    const contribution = await Contribution.findById(contributionId);
    if (!contribution) {
      return c.html('Contribution not found', 404);
    }

    const userSplit = contribution.splits.find(
      (split: any) => split.userId.toString() === userId
    );

    if (!userSplit) {
      return c.html('You are not included in this split', 400);
    }

    const userObj = await User.findById(userId);
    const userName = userObj ? userObj.name : 'Roommate';
    const userEmail = userObj ? userObj.email : 'roommate@hub.com';
    const userPhone = userObj ? userObj.phone : '';

    if (userSplit.status === 'paid') {
      return c.html(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payment Success</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
          <style>
            body { font-family: 'Outfit', sans-serif; }
          </style>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4">
          <div class="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl text-center border border-slate-100">
            <div class="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 class="text-2xl font-bold text-slate-800 mb-2">Already Paid!</h1>
            <p class="text-slate-500 text-sm mb-8">This split contribution has already been successfully settled.</p>
            <button onclick="window.close()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-6 rounded-2xl transition duration-200">
              Close Window
            </button>
          </div>
        </body>
        </html>
      `);
    }

    // Set up payment amount & order
    const amountInPaise = Math.round(userSplit.shareAmount * 100);
    let orderId = userSplit.razorpayOrderId;
    let isMock = true;

    if (razorpay) {
      isMock = false;
      if (!orderId || orderId.startsWith('order_mock_')) {
        try {
          const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${contributionId.substring(0, 10)}_${userId.substring(0, 10)}`,
          });
          orderId = order.id;
          userSplit.razorpayOrderId = orderId;
          await contribution.save();
        } catch (error: any) {
          console.error('Razorpay order creation error:', error);
          return c.html('Failed to create payment order with Razorpay: ' + error.message, 500);
        }
      }
    } else {
      if (!orderId || !orderId.startsWith('order_mock_')) {
        orderId = `order_mock_${crypto.randomBytes(8).toString('hex')}`;
        userSplit.razorpayOrderId = orderId;
        await contribution.save();
      }
    }

    // Serve Razorpay Gateway Checkout HTML
    return c.html(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Secure Razorpay Payment</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        <style>
          body { font-family: 'Outfit', sans-serif; }
        </style>
      </head>
      <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4">
        <div id="payment-card" class="bg-white rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-100 transition-all duration-300">
          <div class="flex items-center justify-between mb-8">
            <span class="text-xs font-bold text-indigo-600 tracking-wider uppercase bg-indigo-50 px-3 py-1 rounded-full">Secure Payment</span>
            <span class="text-xs text-slate-400 font-semibold">${isMock ? 'Sandbox Simulation' : 'Live Gateway'}</span>
          </div>

          <h1 class="text-xl font-bold text-slate-800 mb-1">${contribution.title}</h1>
          <p class="text-slate-400 text-xs mb-6">Payment request for split bill contribution</p>

          <div class="bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100">
            <div class="flex justify-between items-center mb-3">
              <span class="text-slate-500 text-sm font-medium">Roommate</span>
              <span class="text-slate-800 text-sm font-bold">${userName}</span>
            </div>
            <div class="flex justify-between items-center border-t border-slate-200/60 pt-3">
              <span class="text-slate-500 text-sm font-medium">Total Payable</span>
              <span class="text-indigo-600 text-xl font-extrabold">₹${userSplit.shareAmount.toFixed(2)}</span>
            </div>
          </div>

          <div id="status-container" class="space-y-4">
            <button id="pay-btn" onclick="startPayment()" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition duration-200 shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Pay Securely
            </button>
            <p class="text-center text-[10px] text-slate-400 font-medium">
              By paying, you agree to secure transaction terms. Powered by Razorpay.
            </p>
          </div>
        </div>

        <script>
          const isMock = ${isMock};
          
          function showSuccessScreen() {
            const card = document.getElementById('payment-card');
            card.innerHTML = \`
              <div class="text-center py-4">
                <div class="w-16 h-16 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h1 class="text-2xl font-bold text-slate-800 mb-2">Payment Successful!</h1>
                <p class="text-slate-500 text-sm mb-8">Your split contribution is successfully settled and logged.</p>
                <button onclick="window.close()" class="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-6 rounded-2xl transition duration-200">
                  Done & Close
                </button>
              </div>
            \`;
          }

          function showFailureScreen(msg) {
            alert("Payment Failed: " + msg);
          }

          function startPayment() {
            if (isMock) {
              document.getElementById('status-container').innerHTML = \`
                <div class="flex items-center justify-center py-4">
                  <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <span class="ml-3 text-slate-600 text-sm font-semibold">Simulating Payment...</span>
                </div>
              \`;

              setTimeout(() => {
                const mockPayId = "pay_mock_" + Math.random().toString(36).substring(2, 11);
                submitPaymentDetails(mockPayId, "${orderId}", null);
              }, 1200);
            } else {
              const options = {
                key: "${razorpayKeyId}",
                amount: "${amountInPaise}",
                currency: "INR",
                name: "Hubmate",
                description: "${contribution.title}",
                order_id: "${orderId}",
                handler: function(response) {
                  document.getElementById('status-container').innerHTML = \`
                    <div class="flex items-center justify-center py-4">
                      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                      <span class="ml-3 text-slate-600 text-sm font-semibold">Verifying Secure Signature...</span>
                    </div>
                  \`;
                  submitPaymentDetails(
                    response.razorpay_payment_id,
                    response.razorpay_order_id,
                    response.razorpay_signature
                  );
                },
                prefill: {
                  name: "${userName}",
                  email: "${userEmail}",
                  contact: "${userPhone}"
                },
                theme: {
                  color: "#4f46e5"
                }
              };
              const rzp = new Razorpay(options);
              rzp.on('payment.failed', function (response){
                showFailureScreen(response.error.description);
              });
              rzp.open();
            }
          }

          function submitPaymentDetails(paymentId, orderId, signature) {
            fetch('/pay/verify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contributionId: "${contributionId}",
                userId: "${userId}",
                razorpayPaymentId: paymentId,
                razorpayOrderId: orderId,
                razorpaySignature: signature
              })
            })
            .then(res => res.json())
            .then(data => {
              if (data.success) {
                showSuccessScreen();
              } else {
                showFailureScreen(data.message || 'Signature mismatch');
              }
            })
            .catch(err => {
              showFailureScreen(err.message || 'Server error');
            });
          }

          window.onload = startPayment;
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Payment initialization error:', err);
    return c.html('Server Error: ' + err.message, 500);
  }
});

// Mount tRPC Server middleware
app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
);

app.get('/', (c) => {
  return c.json({ 
    status: 'ok', 
    message: 'Hubmate Backend API is running',
    dbConnected: mongoose.connection.readyState === 1
  });
});

// Database Connection
const mongoUri = process.env.MONGODB_URI;
if (mongoUri) {
  mongoose.connect(mongoUri)
    .then(() => console.log('✅ Connected to MongoDB Atlas'))
    .catch((err) => console.error('❌ MongoDB Connection Error:', err));
} else {
  console.log('⚠️ MONGODB_URI is not set. Server is running without database connection.');
}

const port = Number(process.env.PORT) || 3000;

serve({
  fetch: app.fetch,
  port,
});

console.log(`🚀 Hono backend running at http://localhost:${port}`);
