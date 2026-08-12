const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Firebase Admin Config
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://caro-fa824-default-rtdb.asia-southeast1.firebasedatabase.app'
});

const db = admin.database();

async function uploadToCloud() {
  console.log('======================================');
  console.log('   UPLOAD BACKUP -> FIREBASE CLOUD');
  console.log('======================================');
  console.log();

  const backupPath = path.join(__dirname, '..', 'backup.json');
  
  if (!fs.existsSync(backupPath)) {
    console.log('[ERROR] Khong tim thay backup.json');
    process.exit(1);
  }

  console.log('Reading backup.json...');
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  
  console.log('Checking current data on Firebase Cloud...');
  console.log();
  
  try {
    const snapshot = await db.ref('/').once('value');
    const cloudData = snapshot.val();
    
    // So sánh số lượng user
    const backupUsers = backupData.users ? Object.keys(backupData.users).length : 0;
    const cloudUsers = cloudData && cloudData.users ? Object.keys(cloudData.users).length : 0;
    
    console.log(`Backup: ${backupUsers} users`);
    console.log(`Cloud:  ${cloudUsers} users`);
    console.log();
    
    if (backupUsers === cloudUsers) {
      console.log('[INFO] Số lượng user giống nhau. Đang upload để đồng bộ...');
    }
    
    console.log('Uploading to Firebase Cloud...');
    console.log();
  
  try {
    await db.ref('/').set(backupData);
    console.log('✅ Upload completed without errors');
  } catch (uploadError) {
    console.log('❌ Upload error:', uploadError.message);
    console.log('Error details:', uploadError);
    throw uploadError;
  }
    
    // Verify upload
    console.log('Verifying upload...');
    const verifySnapshot = await db.ref('/').once('value');
    const verifyData = verifySnapshot.val();
    
    const verifyUsers = verifyData && verifyData.users ? Object.keys(verifyData.users).length : 0;
    
    if (verifyUsers === backupUsers) {
      console.log('✅ Verification passed: Data uploaded successfully!');
      console.log(`✅ Cloud now has ${verifyUsers} users (matches backup)`);
    } else {
      console.log(`⚠️ Verification warning: Cloud has ${verifyUsers} users (expected ${backupUsers})`);
    }
    
    console.log('======================================');
    console.log('         UPLOAD HOAN THANH');
    console.log('======================================');
  } catch (error) {
    console.log('[ERROR] Upload failed:', error.message);
    process.exit(1);
  }
}

uploadToCloud().then(() => {
  process.exit(0);
});
