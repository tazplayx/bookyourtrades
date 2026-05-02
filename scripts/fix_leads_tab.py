import sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
content = open('C:/Personal/trades-ontario/index.html', 'r', encoding='utf-8', newline='').read()

LEADS_TAB = (
"\r\n"
"      <!-- Leads Tab -->\r\n"
"      <div id=\"tab-leads\" class=\"tab-content active\">\r\n"
"        ${(function(){\r\n"
"          const isPro = prov.plan==='pro' || prov.plan==='enterprise';\r\n"
"          const allLeads = (App.rfqs||[]).filter(function(r){ return r.status==='open' && r.tradeType===prov.tradeType; })\r\n"
"            .sort(function(a,b){ return new Date(b.createdAt)-new Date(a.createdAt); });\r\n"
"          const FREE_LIMIT = 5;\r\n"
"          const freeLeads   = allLeads.slice(0, FREE_LIMIT);\r\n"
"          const lockedLeads = allLeads.slice(FREE_LIMIT);\r\n"
"\r\n"
"          if (allLeads.length === 0) {\r\n"
"            return '<div style=\"text-align:center;padding:70px 40px;\">'\r\n"
"              + '<div style=\"font-size:48px;margin-bottom:16px;\">&#128203;</div>'\r\n"
"              + '<div style=\"font-family:\\'Barlow Condensed\\',sans-serif;font-size:26px;color:white;margin-bottom:8px;\">No leads yet for ' + prov.tradeType + '</div>'\r\n"
"              + '<div style=\"font-size:14px;color:var(--s400);max-width:400px;margin:0 auto 24px;\">When clients post job requests matching your trade and city, they appear here automatically. Check back soon!</div>'\r\n"
"              + '<button onclick=\"navigate(\\'/rfq\\')\">&#128226; Post Your Own Job Request</button>'\r\n"
"              + '</div>';\r\n"
"          }\r\n"
"\r\n"
"          function renderLead(job, isLocked) {\r\n"
"            const urgencyBadge = job.urgency==='high' ? '<span style=\"background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#FCA5A5;font-size:11px;font-family:\\'Barlow Condensed\\',sans-serif;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:3px 8px;border-radius:4px;\">&#128308; Urgent</span>' : '';\r\n"
"            if (isLocked) {\r\n"
"              return '<div style=\"position:relative;border-radius:10px;overflow:hidden;margin-bottom:12px;\">'\r\n"
"                + '<div style=\"filter:blur(5px);pointer-events:none;user-select:none;background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:22px 26px;\">'\r\n"
"                + '<div style=\"font-family:\\'Barlow Condensed\\',sans-serif;font-weight:700;font-size:19px;color:white;margin-bottom:8px;\">' + (job.title||'Lead Request') + '</div>'\r\n"
"                + '<div style=\"display:flex;gap:14px;font-size:13px;color:var(--s400);\"><span>&#128205; ' + (job.city||'') + ', ' + (job.province||'') + '</span><span>&#128178; ' + (job.budget||'') + '</span><span>&#128336; ' + (job.timeline||'') + '</span></div>'\r\n"
"                + '<div style=\"font-size:14px;color:var(--s300);margin-top:8px;line-height:1.5;\">' + (job.jobDescription||'').slice(0,100) + '...</div>'\r\n"
"                + '</div>'\r\n"
"                + '<div style=\"position:absolute;inset:0;background:rgba(11,17,26,0.75);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;\">'\r\n"
"                + '<span style=\"font-size:28px;\">&#128274;</span>'\r\n"
"                + '<div style=\"font-family:\\'Barlow Condensed\\',sans-serif;font-size:16px;color:white;font-weight:700;\">Unlock with Pro Membership</div>'\r\n"
"                + '<button onclick=\"navigate(\\'/pricing\\')\">Upgrade to Pro &#8594;</button>'\r\n"
"                + '</div>'\r\n"
"                + '</div>';\r\n"
"            }\r\n"
"            return '<div style=\"background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:22px 26px;margin-bottom:12px;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;\">'\r\n"
"              + '<div style=\"flex:1;min-width:240px;\">'\r\n"
"              + '<div style=\"display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;\">'\r\n"
"              + '<div style=\"font-family:\\'Barlow Condensed\\',sans-serif;font-weight:700;font-size:19px;color:white;\">' + (job.title||'Lead Request') + '</div>'\r\n"
"              + urgencyBadge\r\n"
"              + '</div>'\r\n"
"              + '<div style=\"display:flex;gap:14px;flex-wrap:wrap;font-size:13px;color:var(--s400);margin-bottom:10px;\">'\r\n"
"              + '<span>&#128205; ' + (job.city||'') + ', ' + (job.province||'') + '</span>'\r\n"
"              + '<span>&#128178; ' + (job.budget||'TBD') + '</span>'\r\n"
"              + '<span>&#128336; ' + (job.timeline||'Flexible') + '</span>'\r\n"
"              + '<span>&#128197; ' + (job.createdAt ? new Date(job.createdAt).toLocaleDateString('en-CA') : '') + '</span>'\r\n"
"              + '</div>'\r\n"
"              + (job.jobDescription ? '<div style=\"font-size:14px;color:var(--s300);line-height:1.6;margin-bottom:12px;\">' + job.jobDescription + '</div>' : '')\r\n"
"              + '<div style=\"font-size:13px;color:var(--s400);\">&#128100; <strong style=\"color:var(--s200);\">' + (job.contactName||'Client') + '</strong></div>'\r\n"
"              + '</div>'\r\n"
"              + '<div style=\"flex-shrink:0;display:flex;flex-direction:column;gap:8px;min-width:160px;\">'\r\n"
"              + '<a href=\"mailto:' + (job.contactEmail||'') + '\" class=\"btn btn-orange btn-sm\" style=\"text-align:center;\">&#128140; Email Client</a>'\r\n"
"              + (job.contactPhone ? '<a href=\"tel:' + job.contactPhone + '\" class=\"btn btn-outline btn-sm\" style=\"text-align:center;font-size:12px;\">&#128222; ' + job.contactPhone + '</a>' : '')\r\n"
"              + '</div>'\r\n"
"              + '</div>';\r\n"
"          }\r\n"
"\r\n"
"          var html = '';\r\n"
"\r\n"
"          if (!isPro && lockedLeads.length > 0) {\r\n"
"            html += '<div style=\"background:linear-gradient(135deg,#0D1F0D,#1A3A1A);border:1px solid rgba(34,197,94,0.25);border-radius:10px;padding:18px 24px;margin-bottom:24px;display:flex;align-items:center;gap:14px;flex-wrap:wrap;\">'\r\n"
"              + '<span style=\"font-size:20px;\">&#127381;</span>'\r\n"
"              + '<span style=\"flex:1;font-size:14px;color:var(--s200);\"><strong style=\"color:#6FE09A;\">' + allLeads.length + ' ' + prov.tradeType + ' leads</strong> in your area. First 5 are free. <strong style=\"color:white;\">' + lockedLeads.length + ' more</strong> locked behind Pro.</span>'\r\n"
"              + '<button onclick=\"navigate(\\'/pricing\\')\">Unlock All &#8594;</button>'\r\n"
"              + '</div>';\r\n"
"          } else if (isPro) {\r\n"
"            html += '<div style=\"background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:14px 20px;margin-bottom:20px;display:flex;align-items:center;gap:12px;\">'\r\n"
"              + '<span style=\"font-size:16px;\">&#9989;</span>'\r\n"
"              + '<span style=\"font-size:14px;color:var(--s300);\">Full lead access active &mdash; <strong style=\"color:var(--o400);\">' + allLeads.length + ' open ' + prov.tradeType + ' leads</strong> in your area.</span>'\r\n"
"              + '</div>';\r\n"
"          }\r\n"
"\r\n"
"          const visibleLeads = isPro ? allLeads : freeLeads;\r\n"
"          html += visibleLeads.map(function(j){ return renderLead(j, false); }).join('');\r\n"
"          if (!isPro && lockedLeads.length > 0) {\r\n"
"            html += lockedLeads.map(function(j){ return renderLead(j, true); }).join('');\r\n"
"            html += '<div style=\"background:linear-gradient(135deg,#1A0E00,#2C1A00);border:2px solid var(--o500);border-radius:12px;padding:28px 32px;margin-top:24px;text-align:center;\">'\r\n"
"              + '<div style=\"font-size:36px;margin-bottom:12px;\">&#128081;</div>'\r\n"
"              + '<div style=\"font-family:\\'Barlow Condensed\\',sans-serif;font-weight:700;font-size:24px;color:white;margin-bottom:8px;\">Unlock All ' + allLeads.length + ' Leads with Pro</div>'\r\n"
"              + '<p style=\"font-size:14px;color:var(--s300);max-width:480px;margin:0 auto 20px;line-height:1.6;\">Get full contact details, project budgets, and timelines for every matching ' + prov.tradeType + ' lead posted in Canada.</p>'\r\n"
"              + '<div style=\"display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:20px;\">'\r\n"
"              + '<div style=\"display:flex;align-items:center;gap:8px;font-size:13px;color:var(--s200);\"><span style=\"color:#22C55E;font-weight:700;\">&#10003;</span> Unlimited lead access</div>'\r\n"
"              + '<div style=\"display:flex;align-items:center;gap:8px;font-size:13px;color:var(--s200);\"><span style=\"color:#22C55E;font-weight:700;\">&#10003;</span> Full client contact info</div>'\r\n"
"              + '<div style=\"display:flex;align-items:center;gap:8px;font-size:13px;color:var(--s200);\"><span style=\"color:#22C55E;font-weight:700;\">&#10003;</span> Priority listing placement</div>'\r\n"
"              + '</div>'\r\n"
"              + '<button onclick=\"navigate(\\'/pricing\\')\">Upgrade to Pro from $49/mo &#8594;</button>'\r\n"
"              + '</div>';\r\n"
"          }\r\n"
"          return html;\r\n"
"        })()}\r\n"
"      </div>\r\n"
)

# In the new renderDashboard, find <!-- Appointments --> and insert LEADS_TAB before it
# Also change tab-appt from "active" to non-active in the new renderDashboard

rd_start = content.find('function renderDashboard(')
rd_end   = content.find('\nfunction ', rd_start + 100)

before   = content[:rd_start]
rd_chunk = content[rd_start:rd_end]
after    = content[rd_end:]

APPT_ANCHOR = "\r\n      <!-- Appointments -->\r\n      <div id=\"tab-appt\" class=\"tab-content active\">"

if APPT_ANCHOR in rd_chunk:
    replacement = LEADS_TAB + "\r\n      <!-- Appointments -->\r\n      <div id=\"tab-appt\" class=\"tab-content\">"
    rd_chunk = rd_chunk.replace(APPT_ANCHOR, replacement, 1)
    print("SUCCESS: Leads tab inserted, tab-appt active class removed")
else:
    # Try without \r
    APPT_ANCHOR2 = "\n      <!-- Appointments -->\n      <div id=\"tab-appt\" class=\"tab-content active\">"
    if APPT_ANCHOR2 in rd_chunk:
        replacement = LEADS_TAB + "\n      <!-- Appointments -->\n      <div id=\"tab-appt\" class=\"tab-content\">"
        rd_chunk = rd_chunk.replace(APPT_ANCHOR2, replacement, 1)
        print("SUCCESS (LF): Leads tab inserted")
    else:
        # Debug: show what's around Appointments
        idx = rd_chunk.find('<!-- Appointments -->')
        print("Appointments found at offset:", idx)
        if idx >= 0:
            print(repr(rd_chunk[idx-5:idx+100]))
        else:
            print("NOT FOUND")

content = before + rd_chunk + after
open('C:/Personal/trades-ontario/index.html', 'w', encoding='utf-8', newline='').write(content)
print("File written. Length:", len(content))

# Verify: check backtick count
total_bt = content.count('`')
print("Total backticks:", total_bt, "even:", total_bt % 2 == 0)

# Verify tab structure in new renderDashboard
import re
rd_start2 = content.find('function renderDashboard(')
rd_end2   = content.find('\nfunction ', rd_start2 + 100)
chunk2 = content[rd_start2:rd_end2]
actives = [m.start() for m in re.finditer(r'class="tab-content active"', chunk2)]
print("Active tabs in renderDashboard:", len(actives), "at offsets:", actives[:5])
leads_pos = chunk2.find('id="tab-leads"')
print("tab-leads in renderDashboard:", leads_pos)
