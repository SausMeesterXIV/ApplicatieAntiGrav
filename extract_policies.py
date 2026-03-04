import re
import sys

# The path to the uploaded sql file
sql_file = r'C:\Users\tibod\.gemini\antigravity\code_tracker\active\ApplicatieAntiGrav_be2a580ad2ffc3d669374aa6f27008098f26c617\d6419c46bc49f247ecbb137fbf5efc69_supabase.sql'

with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Find all CREATE POLICY lines
policies = re.findall(r'CREATE POLICY.*?ON public\.\w+.*?;\n?', content, re.IGNORECASE | re.DOTALL)

print(f"Found {len(policies)} policies:\n")
for p in policies:
    print(p.strip())
