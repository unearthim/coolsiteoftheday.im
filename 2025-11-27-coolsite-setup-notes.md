# Cool Site of the Day - Setup Notes
**Date:** November 27, 2025

## What We Did Today

### Problem Identified
- The site was showing "yesterday's site" and the archive contained today's site (duplicate)
- This was caused by manually running the Cloud Function multiple times, which created incorrect archive entries
- The queue had mixed test data from manual creation with Gemini

### Actions Taken
1. **Cleaned up the site_queue collection**
   - Renumbered all queue entries to be sequential: queueIndex 1-20
   - Removed any gaps in the sequence
   - Queue dates don't matter for rotation - only queueIndex matters

2. **Cleaned the archive**
   - Deleted the duplicate archive entry for ascii.im (dated 2025-11-27)
   - Archive is now empty and ready for proper daily rotation

3. **Current State (End of Day)**
   - **Featured Site (today)**: "My Cool Website" at ascii.im (queueIndex 3), dated 2025-11-27
   - **Archive**: Empty
   - **Queue**: 20 sites properly numbered 1-20

## How the System Works

### Daily Rotation Logic
The Cloud Function (`coolSiteRotator`) runs at **midnight PST** daily:

1. **Archives** the current "today" site to `daily_sites_archive` collection with its date
2. **Updates** the "today" document with the next queueIndex site and today's date
3. **Loops** back to queueIndex 1 after reaching queueIndex 20

### Key Collections
- **site_queue**: Permanent storage of all 20 sites (never deleted)
- **daily_site/today**: Single document showing current featured site
- **daily_sites_archive**: Historical record of all previously featured sites

### Important Notes
- Don't manually trigger the function multiple times in one day
- The queue is a master list - sites stay there permanently
- The rotation is 20 days long, then loops back to start

## What to Expect Tomorrow (November 28, 2025)

At midnight PST tonight, the function will run automatically:

### Expected Results
- **Featured Site (today)**: "OLO" at olo.im (queueIndex 4), dated 2025-11-28
- **Archive (1)**: "My Cool Website" (ascii.im), dated 2025-11-27

### The Pattern Going Forward
- Each day advances one queueIndex
- Each day archives the previous day's site
- After 20 days, it loops back to queueIndex 1
- Archive grows by one entry per day

## Rotation Schedule (Next 7 Days)
- **Nov 27**: ascii.im (queueIndex 3) ← Current
- **Nov 28**: olo.im (queueIndex 4) ← Tomorrow
- **Nov 29**: queueIndex 5
- **Nov 30**: queueIndex 6
- **Dec 1**: queueIndex 7
- **Dec 2**: queueIndex 8
- **Dec 3**: queueIndex 9

---

**Status:** ✅ System is clean and ready for automated daily rotation
