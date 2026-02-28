import re
import json
import os

def parse_log(log_path):
    mapping = {}
    current_cloudinary_id = None
    
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            # Look for "Processing Cloudinary ID: ..."
            proc_match = re.search(r"Processing Cloudinary ID: ([\w/_-]+)", line)
            if proc_match:
                current_cloudinary_id = proc_match.group(1).split('/')[-1] # Just the public_id
                continue
            
            # Look for "Successfully migrated to Cloudflare: UUID"
            success_match = re.search(r"Successfully migrated to Cloudflare: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", line)
            if success_match and current_cloudinary_id:
                mapping[current_cloudinary_id] = success_match.group(1)
                current_cloudinary_id = None
                
            # Fallback for lines like "Updated Event ...: old -> new"
            dist_match = re.search(r"Updated \w+ [\w-]+: ([\w/_-]+) -> ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})", line)
            if dist_match:
                cid = dist_match.group(1).split('/')[-1]
                mapping[cid] = dist_match.group(2)

    return mapping

if __name__ == "__main__":
    log_file = r"c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend\migration.log"
    results = parse_log(log_file)
    
    output_path = r"c:\Users\Craig\Desktop\projects\antigrav\heh\highland_events_app\backend\migration_mapping.json"
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
        
    print(f"Extracted {len(results)} mappings to migration_mapping.json")
