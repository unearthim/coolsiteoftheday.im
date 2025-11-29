// This code uses the Firebase Admin SDK to interact with Firestore.
// It is now updated to use the Firebase Functions 2nd Generation API.

// 1. Updated Imports for 2nd Gen
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require('firebase-admin');

/**
 * Scheduled function that runs daily to update the "Cool Site of the Day" document.
 */
exports.coolSiteRotator = onSchedule({
        schedule: '0 0 * * *', // Cron schedule: runs at midnight
        timeZone: 'America/Los_Angeles',
        region: 'us-west1', 
    }, 
    async (context) => {
        
        // --- FINAL FIX: Explicitly initialize Admin SDK with App Default Credentials ---
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.applicationDefault(), 
            });
        }
        const db = admin.firestore();
        // --- END FINAL FIX ---

        const appId = 'jojo-4b593'; 
        
        const TODAY_DOC_PATH = `artifacts/${appId}/public/data/daily_site/today`;
        const QUEUE_COLLECTION_PATH = `artifacts/${appId}/public/data/site_queue`;
        const ARCHIVE_COLLECTION_PATH = `artifacts/${appId}/public/data/daily_sites_archive`;

        const todayDocRef = db.doc(TODAY_DOC_PATH);
        const queueCollectionRef = db.collection(QUEUE_COLLECTION_PATH);
        const archiveCollectionRef = db.collection(ARCHIVE_COLLECTION_PATH);

        try {
            // 1. Get the current index and total count
            
            // CRITICAL FIX: Find totalSites using two simpler queries (min and max queueIndex) 
            // instead of reading the entire collection, which is failing the permission check.
            
            // Step 1: Get the current document state
            const todayDoc = await todayDocRef.get(); 
            
            // Step 2: Determine the total number of sites by finding the maximum queueIndex
            const maxIndexSnapshot = await queueCollectionRef.orderBy('queueIndex', 'desc').limit(1).get();
            
            const totalSites = maxIndexSnapshot.empty ? 0 : maxIndexSnapshot.docs[0].data().queueIndex;

            // Ensure currentIndex is a NUMBER, not a string
            const currentIndex = todayDoc.exists ? (Number(todayDoc.data().index) || 0) : 0;

            if (totalSites === 0) {
                console.warn("Site queue is empty. Skipping daily update. (Total Sites: 0)");
                return null;
            }

            // 2. Calculate the next index (handles wrap-around)
            let nextIndex = currentIndex + 1;
            if (nextIndex > totalSites) {
                nextIndex = 1; // Loop back to the first site (index 1)
            }
            
            // 3. Find the next site data by fetching all docs and filtering in memory
            // This avoids needing a Firestore index
            const allQueueDocs = await queueCollectionRef.get();
            
            // DEBUG: Log all queue indices to see what we have
            console.log('🔍 Queue contents:');
            allQueueDocs.forEach(doc => {
                const data = doc.data();
                console.log(`  - Doc ${doc.id}: queueIndex=${data.queueIndex} (type: ${typeof data.queueIndex}), title=${data.title}`);
            });
            console.log(`🎯 Looking for queueIndex: ${nextIndex} (type: ${typeof nextIndex})`);
            
            let nextSiteDoc = null;
            allQueueDocs.forEach(doc => {
                const data = doc.data();
                if (data.queueIndex === nextIndex) {
                    nextSiteDoc = { id: doc.id, ...data };
                }
            });

            if (!nextSiteDoc) {
                throw new Error(`Queue integrity error: Could not find site with queueIndex ${nextIndex} (Total: ${totalSites}). Check logs for queue contents.`);
            }

            const nextSiteData = nextSiteDoc;

            // 4. Archive the OLD site BEFORE updating to the new one
            if (todayDoc.exists) {
                const oldSiteData = todayDoc.data();
                console.log(`🗄️ Archiving old site: ${oldSiteData.siteTitle} (date: ${oldSiteData.date}, index: ${oldSiteData.index})`);
                
                const archivePayload = {
                    siteUrl: oldSiteData.siteUrl,
                    siteTitle: oldSiteData.siteTitle,
                    curatorNote: oldSiteData.curatorNote,
                    date: oldSiteData.date,
                    dateString: oldSiteData.date,
                    index: oldSiteData.index,
                    queueId: oldSiteData.queueId,
                    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                    timestamp: new Date(oldSiteData.date).getTime() // Use the old date for sorting
                };
                
                // Use the old date as document ID to prevent duplicates
                const archiveDocId = oldSiteData.date;
                await archiveCollectionRef.doc(archiveDocId).set(archivePayload, { merge: true });
                console.log(`📁 Archived to daily_sites_archive/${archiveDocId}`);
            } else {
                console.log(`ℹ️ No previous site to archive (first run)`);
            }

            // 5. Prepare the NEW site data (today's date)
            const todayDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            const updatePayload = {
                siteUrl: nextSiteData.url,
                siteTitle: nextSiteData.title,
                curatorNote: nextSiteData.note || 'No note provided for this feature.',
                date: todayDate,
                dateString: todayDate,
                index: nextIndex,
                queueId: nextSiteData.id 
            };

            // 6. Write to today document
            await todayDocRef.set(updatePayload, { merge: true });

            console.log(`✅ Daily update successful. New site index: ${nextIndex} (${nextSiteData.title})`);
            return null;

        } catch (error) {
            console.error("❌ Failed to run coolSiteRotator:", error);
            return null; 
        }
    });