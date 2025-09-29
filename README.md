# Firebase-Clicker
This repository has all the necessary files for the clicker app to work

Prerequisites

Google Cloud Platform account
Firebase project
Docker installed locally
Node.js 18+ and Python 3.11+

1. Firebase Setup
Create Firebase Project
bash# Install Firebase CLI
npm install -g firebase-tools

# Login and create project
firebase login
firebase projects: firestore-clicker-e7014
firebase firestore-clicker-e7014

# Enable services
firebase init firestore
firebase init hosting
firebase init auth
Firebase Configuration
javascript// src/config/firebase.js
export const firebaseConfig = {
  apiKey: "AIzaSyBmRaOCaNUDTEl4GuiWJ_xn-VnFUVDZblM",
  authDomain: "firestore-clicker-e7014.firebaseapp.com",
  projectId: "firestore-clicker-e7014",
  storageBucket: "firestore-clicker-e7014.firebasestorage.app",
  messagingSenderId: "811633533887",
  appId: "1:811633533887:web:048e7190dbcd74b350f70a"
};
Firestore Security Rules
javascript// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
2. Google Cloud Setup
Enable APIs
bashgcloud auth login
gcloud config set project firestore-clicker-e7014

# Enable required APIs
gcloud services enable run.googleapis.com
gcloud services enable compute.googleapis.com
gcloud services enable redis.googleapis.com
gcloud services enable firestore.googleapis.com
Create Service Account
bash# Create service account for Firebase Admin
gcloud iam service-accounts create firebase-admin \
    --description="Firebase Admin SDK service account" \
    --display-name="Firebase Admin"

# Generate key file
gcloud iam service-accounts keys create firebase-admin-key.json \
    --iam-account=firebase-admin@your-project-id.iam.gserviceaccount.com

# Grant Firestore permissions
gcloud projects add-iam-policy-binding your-project-id \
    --member="serviceAccount:firebase-admin@your-project-id.iam.gserviceaccount.com" \
    --role="roles/datastore.user"
3. Redis (Memorystore) Setup
bash# Create Redis instance
gcloud redis instances create click-tracker-redis \
    --size=1 \
    --region=us-central1 \
    --redis-version=redis_7_0 \
    --network=default

# Get Redis connection details
gcloud redis instances describe click-tracker-redis --region=us-central1
4. Backend API Deployment (Cloud Run)
Dockerfile for Backend
dockerfile# backend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Start application
CMD ["npm", "start"]
Deploy to Cloud Run
bash# Build and deploy
cd backend
gcloud builds submit --tag gcr.io/your-project-id/click-tracker-api
gcloud run deploy click-tracker-api \
    --image gcr.io/your-project-id/click-tracker-api \
    --platform managed \
    --region us-central1 \
    --allow-unauthenticated \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars="FIREBASE_PROJECT_ID=your-project-id,REDIS_HOST=your-redis-ip,PORT=8080"
Environment Variables for Cloud Run
bashgcloud run services update click-tracker-api \
    --region us-central1 \
    --set-env-vars="FIREBASE_PROJECT_ID=your-project-id" \
    --set-env-vars="FIREBASE_PRIVATE_KEY_ID=your-private-key-id" \
    --set-env-vars="FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----..." \
    --set-env-vars="FIREBASE_CLIENT_EMAIL=firebase-admin@your-project.iam.gserviceaccount.com" \
    --set-env-vars="FIREBASE_CLIENT_ID=your-client-id" \
    --set-env-vars="REDIS_HOST=10.x.x.x" \
    --set-env-vars="REDIS_PORT=6379" \
    --set-env-vars="GPU_SERVICE_URL=http://your-gpu-service-internal-ip:8000"
5. GPU Service Deployment (GCE)
Create GPU Instance
bash# Create GPU-enabled VM
gcloud compute instances create gpu-compute-service \
    --zone=us-central1-a \
    --machine-type=n1-standard-4 \
    --accelerator=type=nvidia-tesla-t4,count=1 \
    --image-family=ubuntu-2004-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=50GB \
    --maintenance-policy=TERMINATE \
    --restart-on-failure \
    --scopes=https://www.googleapis.com/auth/cloud-platform \
    --tags=gpu-service
Setup GPU Instance
bash# SSH into instance
gcloud compute ssh gpu-compute-service --zone=us-central1-a

# Install Docker and NVIDIA drivers
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
sudo apt-get update && sudo apt-get install -y nvidia-docker2
sudo systemctl restart docker
Deploy GPU Service
bash# Build and run GPU service
cd gpu-service
sudo docker build -t gpu-compute-service .
sudo docker run -d \
    --name gpu-service \
    --gpus all \
    -p 8000:8000 \
    -e REDIS_HOST=10.x.x.x \
    -e REDIS_PORT=6379 \
    --restart unless-stopped \
    gpu-compute-service
Firewall Rules
bash# Create firewall rule for GPU service (internal only)
gcloud compute firewall-rules create allow-gpu-service-internal \
    --allow tcp:8000 \
    --source-ranges 10.0.0.0/8 \
    --target-tags gpu-service \
    --description "Allow internal access to GPU service"
6. Frontend Deployment (Firebase Hosting)
Build Configuration
json// package.json
{
  "name": "click-tracker-frontend",
  "scripts": {
    "build": "react-scripts build",
    "deploy": "npm run build && firebase deploy --only hosting"
  },
  "dependencies": {
    "react": "^18.2.0",
    "firebase": "^10.7.1",
    "socket.io-client": "^4.7.4"
  }
}
Firebase Hosting Config
json// firebase.json
{
  "hosting": {
    "public": "build",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
Deploy Frontend
bash# Update API URL in frontend code
# Replace API_URL with your Cloud Run service URL

# Build and deploy
npm run build
firebase deploy --only hosting
7. Environment Variables Summary
Backend API (.env)
bashFIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-admin@your-project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=your-client-id
REDIS_HOST=10.x.x.x
REDIS_PORT=6379
GPU_SERVICE_URL=http://internal-gpu-ip:8000
PORT=8080
HOST=0.0.0.0
GPU Service (.env)
bashREDIS_HOST=10.x.x.x
REDIS_PORT=6379
PORT=8000
HOST=0.0.0.0
Frontend (environment variables)
javascript// In your React app
const API_URL = 'https://click-tracker-api-xxxxx-uc.a.run.app';
8. Testing & Monitoring
Health Checks
bash# Test API health
curl https://your-cloud-run-url/health

# Test GPU service health
curl http://your-gpu-service-ip:8000/health

# Test Firebase hosting
curl https://your-project-id.web.app
Monitoring Commands
bash# View Cloud Run logs
gcloud run services logs read click-tracker-api --region=us-central1

# View GCE instance logs
gcloud compute ssh gpu-compute-service --zone=us-central1-a
sudo docker logs gpu-service

# Monitor Redis
gcloud redis instances describe click-tracker-redis --region=us-central1
9. Security Considerations
Network Security

GPU service only accessible from Cloud Run (internal networking)
Redis Memorystore in private network
Firestore security rules enforce user isolation

Authentication

Firebase Auth handles user authentication
JWT tokens validated on backend
Service-to-service communication uses internal networks

CORS Configuration
javascript// Backend CORS settings
fastify.register(require('@fastify/cors'), {
  origin: ['https://your-project-id.web.app', 'https://your-project-id.firebaseapp.com'],
  credentials: true
});

🚀 Key Features 
✅ Real-time Click Tracking - Each user's clicks are stored in Firestore and cached in Redis
✅ WebSocket Communication - Live updates across all connected clients
✅ GPU Compute Integration - Trigger GPU operations with progress tracking
✅ Scalable Architecture - Auto-scaling backend, distributed caching
✅ Complete Deployment - Scripts for easy GCP deployment
✅ Monitoring & Health Checks - Built-in monitoring and logging
✅ Security - JWT authentication, network isolation, CORS protection
📁 Project Structure
firestore-clicker/
├── frontend/          # React app (Firebase Hosting)
├── backend/           # Node.js API (Cloud Run)  
├── gpu-service/       # Python GPU service (GCE)
├── deploy.sh          # Main deployment script
