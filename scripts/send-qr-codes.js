/**
 * Script to send QR codes to all teams via API
 */

const API_URL = process.env.API_URL || process.env.PUBLIC_URL || 'http://localhost:3001';

async function sendQRCodes() {
  try {
    console.log('📧 Sending QR codes to all teams...');
    console.log(`🌐 API URL: ${API_URL}`);
    
    const response = await fetch(`${API_URL}/api/ultron?action=send-qrs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    
    console.log('\n📊 Results:');
    console.log(`✅ Sent: ${data.sent}`);
    console.log(`❌ Failed: ${data.failed}`);
    console.log(`⏭️  Skipped: ${data.skipped}`);
    console.log(`📦 Total Teams: ${data.total_teams}`);
    
    if (data.results && data.results.length > 0) {
      console.log('\n✅ Successfully sent to:');
      data.results.forEach(result => {
        console.log(`   - ${result.team_id}: ${result.email}`);
      });
    }
    
    if (data.errors && data.errors.length > 0) {
      console.log('\n❌ Errors:');
      data.errors.forEach(error => {
        console.log(`   - ${error.team_id}: ${error.error}`);
      });
    }
    
    if (data.skipped && data.skipped.length > 0) {
      console.log('\n⏭️  Skipped:');
      data.skipped.forEach(skip => {
        console.log(`   - ${skip.team_id}: ${skip.reason}`);
      });
    }
    
    console.log('\n✨ QR code sending completed!');
    
  } catch (error) {
    console.error('❌ Error sending QR codes:', error.message);
    process.exit(1);
  }
}

// Run the script
sendQRCodes()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
