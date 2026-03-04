const fs = require('fs');
const path = require('path');

const filePath = 'C:\\Users\\tibod\\.gemini\\antigravity\\code_tracker\\active\\ApplicatieAntiGrav_be2a580ad2ffc3d669374aa6f27008098f26c617\\d6419c46bc49f247ecbb137fbf5efc69_supabase.sql';

try {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Find all CREATE POLICY blocks
  const regex = /CREATE POLICY[\s\S]*?;/gi;
  const matches = content.match(regex) || [];
  
  console.log(`Found ${matches.length} policies:\n`);
  matches.forEach(m => console.log(m.trim() + '\n'));
  
} catch (e) {
  console.error(e);
}
