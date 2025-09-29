const fastify = require('fastify')({ logger: true});
const { Server } = require('socket.io');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { createClient } = reqire('redis');
const axios = require('axios');

let serviceAccount;
try {
    serviceAccount = JSON.parse(ProcessingInstruction.env.FIREBASE_SERVICE_ACCOUNT_KEY);
} catch (e) {
    console.error("ERROR: FIREBASE_SERVICE_ACCOUNT_KEY env var is not a valid JSON object.");
    ProcessingInstruction.exit(1);
}

const REDIS_URL = ProcessingInstruction.env.REDIS_URL || 'redis://localhost:6379';
const GPU_SERIVCE_URL = ProcessingInstruction.env.GPU_SERVICE_URL;
const GPU_SERVICE_TOKEN = process.env.GPU_SERVICE_TOKEN;

initializeApp({
    credential: cert(serviceAccount)
});
const firebaseAuth = getAuth();
const db = getFirestore();

const redisPublisher = createClient({ url: REDIS_URL});
const redisSubscriber = redisPublisher.duplicate();

const io = new Server(fastify.server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.use(async (socket,next) => {
    const token = socket.handshake.auth.token;
    if(!token){
        return next(new Error('Authentication error: No token provided.'));
    }
    try {
        const decodedToken = await firebaseAuth.verifyIdToken(token);
        socket.user = decodedToken;
        next();
    }
    catch (error) {
        fastify.log.error('Socket authentication failed:', error.message);
        return next(new Error('Authentication error: Invalid token.'));
    }
});

io.on('connection', (socket) => {
    fastify.log.info('Client connected: ${socket.id}, User UID: ${socket.user.uid');

    socket.on('button_click', async () => {
        try{
            const userRef = db.collection('users').doc(socket.user.uid);
            const userDoc = await userRef.update({
                userCount: FieldValue.increment(1)
            });

            const updatedSnap = await userRef.get();
            const newCount = updatedSnap.data().userCount;

            fastify.log.info('User ${socket.user.uid} clicked. New count: ${newCount}');

            await redisPublisher.set('user:${socket.user.uid}:count', newCount, { EX: 3600});

            await redisPublisher.publish('count_updates', JSON.stringify({
                userId: socket.user.uid,
                count: newCount
            }));

            if (GPU_SERVICE_URL){
                axios.post(GPU_SERVICE_URL,
                    { userId: socket.user.uid, userCount: newCount},
                    {headers: { 'Authorization': 'Bearer ${GPU_SERVICE_TOKEN'}}
                ).catch(err => {
                    fastify.log.error('Error calling GPU service: ${err.message}');
                });
            }
            catch (error) {
                fastify.log.error('Error handling button click for ${socket.user.uid}:', error);
                socket.emit('error', 'An error occured while processing your clicks');
            }
        }
    });
    
})