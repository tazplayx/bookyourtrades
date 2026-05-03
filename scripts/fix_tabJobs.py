import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
content = open('C:/Personal/trades-ontario/index.html', 'r', encoding='utf-8', newline='').read()

# Replace the old tab-jobs (Available Careers / RFQs) block entirely
# with a simple "My Posted RFQs" view (provider's own RFQs / quotes they sent)
start = content.rfind('<!--', 0, content.find('Available Careers / RFQs'))
end   = content.find('<!-- Post a Job -->')

old_block = content[start:end]

new_block = (
"      <!-- tab-jobs: hidden / merged into Leads tab -->\r\n"
"      <!-- (tab-jobs id kept for backward compat with any deep links) -->\r\n"
"      <div id=\"tab-jobs\" class=\"tab-content\" style=\"display:none;\"></div>\r\n"
"\r\n"
)

print("Replacing block of", len(old_block), "chars")
content = content[:start] + new_block + content[end:]
open('C:/Personal/trades-ontario/index.html', 'w', encoding='utf-8', newline='').write(content)
print("Done, new length:", len(content))
