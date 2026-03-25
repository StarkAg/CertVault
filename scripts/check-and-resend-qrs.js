/**
 * Script to check all teams and resend QR codes
 * This will send QR codes to ALL teams regardless of whether they received them before
 */

const API_URL = process.env.API_URL || process.env.PUBLIC_URL || 'http://localhost:3001';

async function checkAndResendQRs() {
  try {
    console.log('🔍 Checking all teams in database...\n');
    
    // Get all teams
    const teamsResponse = await fetch(`${API_URL}/api/ultron?action=teams`);
    const teams = await teamsResponse.json();
    
    console.log(`📊 Found ${teams.length} teams in database:\n`);
    teams.forEach((team, index) => {
      console.log(`${index + 1}. ${team.team_id} - ${team.team_name}`);
      console.log(`   Leader: ${team.leader_name || 'N/A'}`);
      console.log(`   Email: ${team.leader_email || '❌ NO EMAIL'}`);
      console.log(`   Team Size: ${team.team_size}`);
      console.log('');
    });
    
    // Count teams with and without emails
    const teamsWithEmail = teams.filter(t => t.leader_email && t.leader_email.trim() !== '');
    const teamsWithoutEmail = teams.filter(t => !t.leader_email || t.leader_email.trim() === '');
    
    console.log(`\n📧 Summary:`);
    console.log(`   Teams with email: ${teamsWithEmail.length}`);
    console.log(`   Teams without email: ${teamsWithoutEmail.length}`);
    
    if (teamsWithoutEmail.length > 0) {
      console.log(`\n⚠️  Teams without email addresses:`);
      teamsWithoutEmail.forEach(team => {
        console.log(`   - ${team.team_id}: ${team.team_name}`);
      });
    }
    
    console.log(`\n📤 Sending QR codes to all teams with valid emails...\n`);
    
    // Send QR codes
    const sendResponse = await fetch(`${API_URL}/api/ultron?action=send-qrs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!sendResponse.ok) {
      const errorText = await sendResponse.text();
      throw new Error(`HTTP ${sendResponse.status}: ${errorText}`);
    }

    const result = await sendResponse.json();
    
    console.log(`\n✅ Results:`);
    console.log(`   Sent: ${result.sent}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Total Teams: ${result.total_teams}`);
    
    if (result.results && result.results.length > 0) {
      console.log(`\n✅ Successfully sent QR codes to:`);
      result.results.forEach(r => {
        console.log(`   - ${r.team_id}: ${r.email}`);
      });
    }
    
    if (result.errors && result.errors.length > 0) {
      console.log(`\n❌ Errors:`);
      result.errors.forEach(e => {
        console.log(`   - ${e.team_id}: ${e.error}`);
      });
    }
    
    if (result.skipped && result.skipped.length > 0) {
      console.log(`\n⏭️  Skipped:`);
      result.skipped.forEach(s => {
        console.log(`   - ${s.team_id}: ${s.reason}`);
      });
    }
    
    console.log(`\n✨ Process completed!`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
checkAndResendQRs()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
