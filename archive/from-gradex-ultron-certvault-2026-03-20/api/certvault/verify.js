/**
 * API Route: /api/certvault/verify
 * Certificate Verification Endpoint for IEEE CS SRM Hize
 * POST /api/certvault/verify - Verify certificate by ID and name
 */

import { supabase, isSupabaseConfigured } from '../../lib/api-utils/supabase-client.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    if (!isSupabaseConfigured() || !supabase) {
      console.error('[CertVault] Supabase not configured');
      res.status(500).json({
        success: false,
        error: 'Certificate verification service is not available'
      });
      return;
    }

    const { certificateId, name } = req.body;

    if (!certificateId || !name) {
      res.status(400).json({
        success: false,
        error: 'Certificate ID and name are required'
      });
      return;
    }

    const normalizedId = certificateId.toString().trim().toUpperCase();
    const normalizedName = name.toString().trim().toLowerCase();

    console.log(`[CertVault] Verification attempt: ID=${normalizedId}, Name=${normalizedName.substring(0, 3)}***`);

    const { data, error } = await supabase
      .from('certificates')
      .select('*')
      .eq('certificate_id', normalizedId)
      .single();

    if (error) {
      console.error('[CertVault] Database query error:', error.message);
      if (error.code === 'PGRST116') {
        res.status(200).json({
          success: true,
          verified: false,
          message: 'Certificate ID not found in our records',
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to verify certificate'
      });
      return;
    }

    if (!data) {
      res.status(200).json({
        success: true,
        verified: false,
        message: 'Certificate ID not found in our records',
      });
      return;
    }

    const dbName = (data.recipient_name || '').toString().trim().toLowerCase();
    const isNameMatch = dbName === normalizedName;

    if (isNameMatch) {
      console.log(`[CertVault] ✓ Verification successful for ${normalizedId}`);
      res.status(200).json({
        success: true,
        verified: true,
        certificateData: {
          name: data.recipient_name,
          event: data.event_name || 'IEEE CS SRM Event',
          date: data.issue_date ? new Date(data.issue_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : undefined,
          organization: data.organization || 'IEEE CS SRM Hize',
        },
      });
    } else {
      console.log(`[CertVault] ✗ Name mismatch for ${normalizedId}`);
      res.status(200).json({
        success: true,
        verified: false,
        message: 'Name does not match our records for this certificate',
      });
    }

  } catch (err) {
    console.error('[CertVault] Error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}
