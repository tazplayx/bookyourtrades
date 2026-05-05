/* ============================================================
   ADMIN PANEL
============================================================ */
function renderAdmin() {
  if (!App.currentUser || App.currentUser.role !== 'admin') { navigate('/login'); return; }
  var el = document.getElementById('adminContent');
  if (!el) return;

  var allProviders = App.providers || [];
  var allUsers     = App.users || [];
  var allClients   = App.clients || [];
  var allBookings  = App.bookings || [];
  var allInquiries = App.inquiries || [];
  var allRFQs      = App.rfqs || [];
  var pending      = allProviders.filter(function(p){ return p.status === 'pending'; });
  var proPlans     = allProviders.filter(function(p){ return p.plan === 'pro' || p.plan === 'enterprise'; });
  var inquiryNew   = allInquiries.filter(function(i){ return i.status === 'new'; }).length;
  var totalRevenue = (proPlans.length * 49).toLocaleString('en-CA');
  var blogPosts    = getBlogPosts();
  var allJobPosts  = App.jobPostings || [];

  var pendingBadge = pending.length > 0
    ? ' <span style="background:#F59E0B;color:#000;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:4px;">' + pending.length + '</span>'
    : '';
  var inquiryBadge = inquiryNew > 0
    ? ' <span style="background:#EF4444;color:white;border-radius:999px;padding:1px 7px;font-size:11px;margin-left:4px;">' + inquiryNew + '</span>'
    : '';

  var overviewStats = [
    {label:'Total Listings',  val: allProviders.length,                                                      color:'var(--o400)'},
    {label:'Claimed',         val: allProviders.filter(function(p){ return p.claimed; }).length,              color:'#22C55E'},
    {label:'Pending Approval',val: pending.length,                                                           color:'#F59E0B'},
    {label:'Pro / Enterprise',val: proPlans.length,                                                          color:'var(--o400)'},
    {label:'Client Accounts', val: allClients.length,                                                        color:'var(--s200)'},
    {label:'Open RFQs',       val: allRFQs.filter(function(r){ return r.status==='open'; }).length,          color:'#60A5FA'},
    {label:'Bookings',        val: allBookings.length,                                                       color:'var(--s200)'},
    {label:'Est. MRR (CAD)',  val: '$' + totalRevenue,                                                       color:'#22C55E'},
  ];

  /* ─── recent inquiries ─── */
  var recentInqHtml = allInquiries.length === 0
    ? '<div style="color:var(--s400);font-size:14px;padding:20px 0;text-align:center;">No inquiries yet.</div>'
    : allInquiries.slice(0,5).map(function(i){
        return '<div style="padding:12px 0;border-bottom:1px solid var(--n500);display:flex;align-items:center;gap:12px;">'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:14px;color:white;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + i.name + ' — ' + i.subject + '</div>'
          + '<div style="font-size:12px;color:var(--s400);">' + i.email + ' &bull; ' + new Date(i.createdAt).toLocaleDateString('en-CA') + '</div>'
          + '</div>'
          + '<span class="badge ' + (i.status==='new'?'badge-orange':'badge-navy') + '" style="font-size:11px;">' + i.status + '</span>'
          + '</div>';
      }).join('');
  if (allInquiries.length > 5) {
    recentInqHtml += '<button class="btn btn-navy btn-sm" style="margin-top:14px;" onclick="switchTab(\'atab-inquiries\',document.querySelectorAll(\'.tab-btn\')[7])">View All ' + allInquiries.length + ' Inquiries</button>';
  }

  /* ─── pending approvals mini list ─── */
  var pendingMiniHtml = pending.length === 0
    ? '<div style="color:var(--s400);font-size:14px;padding:20px 0;text-align:center;">No pending approvals.</div>'
    : pending.slice(0,5).map(function(p){
        return '<div style="padding:12px 0;border-bottom:1px solid var(--n500);display:flex;align-items:center;gap:12px;">'
          + '<div style="flex:1;min-width:0;">'
          + '<div style="font-size:14px;color:white;font-weight:600;">' + p.companyName + '</div>'
          + '<div style="font-size:12px;color:var(--s400);">' + p.tradeType + ' &bull; ' + ((p.serviceAreas||[])[0]||'—') + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:6px;">'
          + '<button class="btn btn-sm" style="background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3);" onclick="adminApproveProvider(\'' + p.id + '\')">&#10003;</button>'
          + '<button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminRejectProvider(\'' + p.id + '\')">&#10005;</button>'
          + '</div>'
          + '</div>';
      }).join('');

  /* ─── memberships table ─── */
  var claimedProviders = allProviders.filter(function(p){ return p.claimed; });
  var membershipsRows = claimedProviders.length === 0
    ? '<tr><td colspan="4" style="padding:30px;text-align:center;color:var(--s400);">No claimed listings yet.</td></tr>'
    : claimedProviders.map(function(p){
        return '<tr style="border-top:1px solid var(--n500);">'
          + '<td style="padding:10px 14px;color:white;font-weight:600;">' + p.companyName + '<div style="font-size:12px;color:var(--s400);">' + (p.email||'') + '</div></td>'
          + '<td style="padding:10px 14px;color:var(--s300);">' + p.tradeType + '</td>'
          + '<td style="padding:10px 14px;"><span class="badge ' + (p.plan==='enterprise'?'badge-orange':p.plan==='pro'?'badge-orange':'badge-navy') + '">' + (p.plan||'free') + '</span></td>'
          + '<td style="padding:10px 14px;"><select class="form-control" style="max-width:140px;padding:5px 8px;font-size:12px;" onchange="adminChangePlan(\'' + p.id + '\',this.value)">'
          + '<option ' + ((!p.plan||p.plan==='free')?'selected':'') + ' value="free">Free</option>'
          + '<option ' + (p.plan==='pro'?'selected':'') + ' value="pro">Pro ($49/mo)</option>'
          + '<option ' + (p.plan==='enterprise'?'selected':'') + ' value="enterprise">Enterprise</option>'
          + '</select></td>'
          + '</tr>';
      }).join('');

  /* ─── accounts rows ─── */
  var userRows = allUsers.map(function(u){
    var prov = App.providers.find(function(p){ return p.id===u.providerId; });
    return '<tr style="border-top:1px solid var(--n500);">'
      + '<td style="padding:10px 14px;color:var(--s200);">' + u.email + '</td>'
      + '<td style="padding:10px 14px;color:var(--s300);">' + (prov ? prov.companyName : '<em style="color:var(--s500);">No listing</em>') + '</td>'
      + '<td style="padding:10px 14px;">' + (prov ? '<span class="badge ' + (prov.plan==='pro'?'badge-orange':'badge-navy') + '">' + (prov.plan||'free') + '</span>' : '—') + '</td>'
      + '<td style="padding:10px 14px;"><button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteUser(\'' + u.id + '\',\'provider\')">Remove</button></td>'
      + '</tr>';
  }).join('');

  var clientRows = allClients.map(function(c){
    return '<tr style="border-top:1px solid var(--n500);">'
      + '<td style="padding:10px 14px;color:var(--s200);">' + (c.name||'—') + '</td>'
      + '<td style="padding:10px 14px;color:var(--s300);">' + c.email + '</td>'
      + '<td style="padding:10px 14px;"><span class="badge badge-navy">' + (c.role||'client') + '</span></td>'
      + '<td style="padding:10px 14px;"><button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteUser(\'' + c.id + '\',\'client\')">Remove</button></td>'
      + '</tr>';
  }).join('');

  /* ─── jobs table ─── */
  var jobRows = allJobPosts.length === 0
    ? '<tr><td colspan="5" style="padding:40px;text-align:center;color:var(--s400);">No job postings yet.</td></tr>'
    : allJobPosts.slice().reverse().map(function(j){
        var prov2 = App.providers.find(function(p){ return p.id===j.providerId; });
        return '<tr style="border-top:1px solid var(--n500);">'
          + '<td style="padding:10px 14px;color:white;font-weight:600;">' + j.title + '<div style="font-size:12px;color:var(--s400);">' + j.trade + ' &bull; ' + j.city + '</div></td>'
          + '<td style="padding:10px 14px;color:var(--s300);">' + (prov2 ? prov2.companyName : 'Unknown') + '</td>'
          + '<td style="padding:10px 14px;"><span class="badge badge-navy">' + j.type + '</span></td>'
          + '<td style="padding:10px 14px;"><span class="badge ' + (j.status==='open'?'badge-green':'badge-yellow') + '">' + j.status + '</span></td>'
          + '<td style="padding:10px 14px;"><button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteJobPost(\'' + j.id + '\')">Remove</button></td>'
          + '</tr>';
      }).join('');

  /* ─── inquiries list ─── */
  var autoApproveChecked = localStorage.getItem('byt_autoApprove') === 'true';
  var regOpenChecked     = localStorage.getItem('byt_regOpen') !== 'false';

  var inquiriesHtml = allInquiries.length === 0
    ? '<div style="text-align:center;padding:60px;color:var(--s400);"><div style="font-size:40px;margin-bottom:12px;">&#128140;</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;color:white;margin-bottom:8px;">No inquiries yet</div><div style="font-size:14px;">Contact form submissions will appear here.</div></div>'
    : allInquiries.map(function(i){
        var replyBoxId  = 'replyBox_'  + i.id;
        var replyTextId = 'replyText_' + i.id;
        var inqDivId    = 'inq_'       + i.id;
        var safeEmail   = i.email.replace(/'/g, '');
        var safeName    = i.name.replace(/'/g, '');
        return '<div id="' + inqDivId + '" style="background:var(--n700);border:1px solid ' + (i.status==='new'?'rgba(239,68,68,0.4)':'var(--n500)') + ';border-radius:10px;padding:20px 24px;margin-bottom:12px;">'
          + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:12px;">'
          + '<div>'
          + '<div style="font-weight:700;font-size:17px;color:white;">' + i.name + ' &mdash; <span style="color:var(--s300);font-weight:400;">' + i.subject + '</span></div>'
          + '<div style="font-size:13px;color:var(--s400);margin-top:3px;">' + i.email + (i.phone?' &bull; '+i.phone:'') + ' &bull; ' + new Date(i.createdAt).toLocaleString('en-CA',{dateStyle:'medium',timeStyle:'short'}) + '</div>'
          + '</div>'
          + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
          + '<span class="badge ' + (i.status==='new'?'badge-orange':'badge-navy') + '">' + i.status + '</span>'
          + (i.replied ? '<span class="badge badge-green">Replied</span>' : '')
          + '<button class="btn btn-sm btn-navy" onclick="adminMarkInquiryRead(\'' + i.id + '\')">Mark Read</button>'
          + '<button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteInquiry(\'' + i.id + '\')">Delete</button>'
          + '</div>'
          + '</div>'
          + '<div style="background:var(--n800);border-radius:6px;padding:14px 16px;font-size:14px;color:var(--s200);line-height:1.7;white-space:pre-wrap;margin-bottom:14px;">' + i.message + '</div>'
          + '<div style="border-top:1px solid var(--n500);padding-top:14px;">'
          + '<div style="font-size:13px;color:var(--s400);margin-bottom:8px;">Reply from info@bookyourtrades.com:</div>'
          + '<div id="' + replyBoxId + '" style="display:none;">'
          + '<textarea id="' + replyTextId + '" class="form-control" style="min-height:100px;margin-bottom:10px;" placeholder="Type your reply to ' + safeName + '..."></textarea>'
          + '<div style="display:flex;gap:8px;">'
          + '<button class="btn btn-orange btn-sm" onclick="adminSendReply(\'' + i.id + '\',\'' + safeEmail + '\',\'' + safeName + '\')">Send Reply &#8594;</button>'
          + '<button class="btn btn-navy btn-sm" onclick="document.getElementById(\'' + replyBoxId + '\').style.display=\'none\'">Cancel</button>'
          + '</div>'
          + '</div>'
          + (!i.replied
            ? '<button class="btn btn-outline btn-sm" onclick="document.getElementById(\'' + replyBoxId + '\').style.display=\'block\'">&#128140; Reply to ' + safeEmail + '</button>'
            : '<div style="color:#22C55E;font-size:13px;">&#10003; Reply sent</div>')
          + '</div>'
          + '</div>';
      }).join('');

  el.innerHTML =
    '<div style="background:var(--n800);border-bottom:3px solid var(--o500);padding:32px 0;">'
    + '<div class="container">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;">'
    + '<div>'
    + '<div style="font-size:12px;color:var(--o400);font-family:\'Barlow Condensed\',sans-serif;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:4px;">&#9889; Super Admin</div>'
    + '<h1 style="font-size:32px;color:white;">BookYourTrades Control Panel</h1>'
    + '</div>'
    + '<div style="display:flex;gap:24px;flex-wrap:wrap;">'
    + '<div style="text-align:center;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:28px;color:var(--o400);">' + allProviders.length + '</div><div style="font-size:12px;color:var(--s400);">Listings</div></div>'
    + '<div style="text-align:center;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:28px;color:var(--o400);">' + (allUsers.length + allClients.length) + '</div><div style="font-size:12px;color:var(--s400);">Accounts</div></div>'
    + '<div style="text-align:center;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:28px;color:#F59E0B;">' + pending.length + '</div><div style="font-size:12px;color:var(--s400);">Pending</div></div>'
    + (inquiryNew > 0 ? '<div style="text-align:center;"><div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:28px;color:#F87171;">' + inquiryNew + '</div><div style="font-size:12px;color:var(--s400);">New Inquiries</div></div>' : '')
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'

    + '<div class="container" style="padding-top:36px;padding-bottom:80px;">'
    + '<div class="tab-bar" style="flex-wrap:wrap;">'
    + '<button class="tab-btn active" onclick="switchTab(\'atab-overview\',this)">&#128200; Overview</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-listings\',this)">&#127970; Listings (' + allProviders.length + ')</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-pending\',this)">&#9203; Pending' + pendingBadge + '</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-accounts\',this)">&#128100; Accounts</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-memberships\',this)">&#128081; Memberships</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-blog\',this)">&#128221; Blog</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-jobs\',this)">&#128188; Careers &amp; Jobs</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-inquiries\',this)">&#128140; Inquiries' + inquiryBadge + '</button>'
    + '<button class="tab-btn" onclick="switchTab(\'atab-settings\',this)">&#9881;&#65039; Settings</button>'
    + '</div>'

    /* OVERVIEW */
    + '<div id="atab-overview" class="tab-content active">'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:20px;margin-bottom:40px;">'
    + overviewStats.map(function(s){ return '<div class="stat-card"><div class="stat-value" style="color:' + s.color + ';">' + s.val + '</div><div class="stat-label">' + s.label + '</div></div>'; }).join('')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;flex-wrap:wrap;">'
    + '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:24px;">'
    + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:18px;color:white;margin-bottom:16px;">Recent Inquiries</div>'
    + recentInqHtml
    + '</div>'
    + '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:24px;">'
    + '<div style="font-family:\'Barlow Condensed\',sans-serif;font-weight:700;font-size:18px;color:white;margin-bottom:16px;">Pending Approvals</div>'
    + pendingMiniHtml
    + '</div>'
    + '</div>'
    + '</div>'

    /* LISTINGS */
    + '<div id="atab-listings" class="tab-content">'
    + '<div style="margin-bottom:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;">'
    + '<input id="adminListingSearch" class="form-control" style="max-width:320px;" placeholder="Search by name or trade..." oninput="adminFilterListings2()" />'
    + '<select id="adminListingStatusFilter" class="form-control" style="max-width:160px;" onchange="adminFilterListings2()">'
    + '<option value="">All statuses</option><option value="active">Active</option><option value="pending">Pending</option>'
    + '</select>'
    + '<button class="btn btn-orange btn-sm" onclick="adminOpenEdit2(null)">+ Add Listing</button>'
    + '</div>'
    + '<div id="adminListingsTable2">' + renderAdminListingsTable2(allProviders) + '</div>'
    + '</div>'

    /* PENDING */
    + '<div id="atab-pending" class="tab-content">'
    + (pending.length === 0
      ? '<div style="text-align:center;padding:60px;color:var(--s400);"><div style="font-size:40px;margin-bottom:12px;">&#9989;</div><div style="font-family:\'Barlow Condensed\',sans-serif;font-size:22px;color:white;margin-bottom:8px;">All caught up!</div><div style="font-size:14px;">No listings awaiting approval.</div></div>'
      : pending.map(function(p){
          return '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:20px 24px;margin-bottom:12px;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;">'
            + '<div style="flex:1;min-width:240px;">'
            + '<div style="font-weight:700;font-size:18px;color:white;margin-bottom:6px;">' + p.companyName + '</div>'
            + '<div style="display:flex;gap:10px;flex-wrap:wrap;font-size:13px;color:var(--s400);margin-bottom:8px;">'
            + '<span>&#128296; ' + p.tradeType + '</span>'
            + '<span>&#128205; ' + ((p.serviceAreas||[])[0]||'—') + '</span>'
            + (p.email ? '<span>&#128140; ' + p.email + '</span>' : '')
            + '</div>'
            + (p.description ? '<div style="font-size:13px;color:var(--s300);line-height:1.6;">' + p.description.slice(0,180) + (p.description.length>180?'…':'') + '</div>' : '')
            + '</div>'
            + '<div style="display:flex;flex-direction:column;gap:8px;min-width:140px;">'
            + '<button class="btn btn-sm" style="background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3);justify-content:center;" onclick="adminApproveProvider(\'' + p.id + '\')">&#10003; Approve</button>'
            + '<button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;justify-content:center;" onclick="adminRejectProvider(\'' + p.id + '\')">&#10005; Reject</button>'
            + '<button class="btn btn-sm btn-navy" onclick="adminOpenEdit2(\'' + p.id + '\')">&#9998; Edit</button>'
            + '</div>'
            + '</div>';
        }).join(''))
    + '</div>'

    /* ACCOUNTS */
    + '<div id="atab-accounts" class="tab-content">'
    + '<h3 style="font-size:18px;margin-bottom:16px;color:white;">Provider Accounts (' + allUsers.length + ')</h3>'
    + '<div style="overflow-x:auto;margin-bottom:36px;"><table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);"><th style="padding:10px 14px;text-align:left;">Email</th><th style="padding:10px 14px;text-align:left;">Linked Listing</th><th style="padding:10px 14px;text-align:left;">Plan</th><th style="padding:10px 14px;text-align:left;">Actions</th></tr></thead>'
    + '<tbody>' + userRows + '</tbody></table></div>'
    + '<h3 style="font-size:18px;margin-bottom:16px;color:white;">Client Accounts (' + allClients.length + ')</h3>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);"><th style="padding:10px 14px;text-align:left;">Name</th><th style="padding:10px 14px;text-align:left;">Email</th><th style="padding:10px 14px;text-align:left;">Role</th><th style="padding:10px 14px;text-align:left;">Actions</th></tr></thead>'
    + '<tbody>' + clientRows + '</tbody></table></div>'
    + '</div>'

    /* MEMBERSHIPS */
    + '<div id="atab-memberships" class="tab-content">'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:16px;margin-bottom:24px;">'
    + [
        {label:'Total Listings', val:allProviders.length},
        {label:'Free Plan', val:allProviders.filter(function(p){ return !p.plan||p.plan==='free'; }).length},
        {label:'Pro Plan', val:allProviders.filter(function(p){ return p.plan==='pro'; }).length},
        {label:'Enterprise', val:allProviders.filter(function(p){ return p.plan==='enterprise'; }).length},
      ].map(function(s){ return '<div class="stat-card"><div class="stat-value" style="font-size:28px;">' + s.val + '</div><div class="stat-label">' + s.label + '</div></div>'; }).join('')
    + '</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);"><th style="padding:10px 14px;text-align:left;">Company</th><th style="padding:10px 14px;text-align:left;">Trade</th><th style="padding:10px 14px;text-align:left;">Plan</th><th style="padding:10px 14px;text-align:left;">Change Plan</th></tr></thead>'
    + '<tbody>' + membershipsRows + '</tbody></table></div>'
    + '</div>'

    /* BLOG */
    + '<div id="atab-blog" class="tab-content">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">'
    + '<h3 style="font-size:20px;color:white;">' + blogPosts.length + ' Blog Posts</h3>'
    + '<button class="btn btn-orange btn-sm" onclick="adminOpenBlogForm(\'\')">+ New Post</button>'
    + '</div>'
    + '<div id="adminBlogList">' + adminRenderBlogList() + '</div>'
    + '<div id="adminBlogFormWrap" style="display:none;"></div>'
    + '</div>'

    /* JOBS */
    + '<div id="atab-jobs" class="tab-content">'
    + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;">'
    + '<h3 style="font-size:20px;color:white;">' + allJobPosts.length + ' Job Postings</h3>'
    + '</div>'
    + '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);"><th style="padding:10px 14px;text-align:left;">Title</th><th style="padding:10px 14px;text-align:left;">Company</th><th style="padding:10px 14px;text-align:left;">Type</th><th style="padding:10px 14px;text-align:left;">Status</th><th style="padding:10px 14px;text-align:left;">Actions</th></tr></thead>'
    + '<tbody>' + jobRows + '</tbody></table></div>'
    + '</div>'

    /* INQUIRIES */
    + '<div id="atab-inquiries" class="tab-content">' + inquiriesHtml + '</div>'

    /* SETTINGS */
    + '<div id="atab-settings" class="tab-content">'
    + '<div style="max-width:680px;">'
    + '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:28px;margin-bottom:24px;">'
    + '<h3 style="font-size:20px;color:white;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--n500);">Registration Settings</h3>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid var(--n600);">'
    + '<div><div style="font-size:15px;color:white;font-weight:600;">Auto-approve new listings</div><div style="font-size:13px;color:var(--s400);margin-top:2px;">When enabled, new listings go live immediately without review</div></div>'
    + '<label style="position:relative;display:inline-block;width:48px;height:26px;cursor:pointer;flex-shrink:0;">'
    + '<input type="checkbox" id="settingAutoApprove" style="opacity:0;width:0;height:0;" onchange="adminSaveSetting(\'autoApprove\',this.checked)" ' + (autoApproveChecked?'checked':'') + '>'
    + '<span style="position:absolute;inset:0;background:' + (autoApproveChecked?'var(--o500)':'var(--n400)') + ';border-radius:26px;transition:0.3s;"></span>'
    + '<span style="position:absolute;left:' + (autoApproveChecked?'24':'4') + 'px;top:4px;width:18px;height:18px;background:white;border-radius:50%;transition:0.3s;"></span>'
    + '</label></div>'
    + '<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;">'
    + '<div><div style="font-size:15px;color:white;font-weight:600;">Allow new registrations</div><div style="font-size:13px;color:var(--s400);margin-top:2px;">When disabled, registration page shows a closed message</div></div>'
    + '<label style="position:relative;display:inline-block;width:48px;height:26px;cursor:pointer;flex-shrink:0;">'
    + '<input type="checkbox" id="settingRegOpen" style="opacity:0;width:0;height:0;" onchange="adminSaveSetting(\'regOpen\',this.checked)" ' + (regOpenChecked?'checked':'') + '>'
    + '<span style="position:absolute;inset:0;background:' + (regOpenChecked?'var(--o500)':'var(--n400)') + ';border-radius:26px;transition:0.3s;"></span>'
    + '<span style="position:absolute;left:' + (regOpenChecked?'24':'4') + 'px;top:4px;width:18px;height:18px;background:white;border-radius:50%;transition:0.3s;"></span>'
    + '</label></div>'
    + '</div>'
    + '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:28px;">'
    + '<h3 style="font-size:20px;color:white;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid var(--n500);">Data Management</h3>'
    + '<div style="display:flex;flex-direction:column;gap:12px;">'
    + '<button class="btn btn-navy" onclick="adminExportData()">&#11015; Export All Listings (JSON)</button>'
    + '<button class="btn btn-navy" onclick="adminClearInquiries()">&#128465; Clear All Inquiries</button>'
    + '<button class="btn" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="if(confirm(\'Reset ALL localStorage data? This cannot be undone.\'))adminHardReset()">&#9888; Hard Reset — Wipe All Data</button>'
    + '</div>'
    + '</div>'
    + '</div>'
    + '</div>'

    + '</div>'

    /* Edit Modal */
    + '<div id="adminEditModal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;overflow-y:auto;padding:40px 20px;">'
    + '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;max-width:720px;margin:0 auto;padding:32px;position:relative;">'
    + '<button onclick="closeAdminEdit()" style="position:absolute;top:16px;right:20px;background:none;border:none;color:var(--s300);font-size:24px;cursor:pointer;">&times;</button>'
    + '<h2 style="font-size:24px;margin-bottom:24px;padding-bottom:14px;border-bottom:1px solid var(--n500);">Edit Listing</h2>'
    + '<div id="adminEditFormContainer"></div>'
    + '</div>'
    + '</div>';
}

/* ─── Admin helper functions ─── */

function renderAdminListingsTable2(providers) {
  if (!providers.length) return '<div style="padding:40px;text-align:center;color:var(--s400);">No listings found.</div>';
  return '<div style="overflow-x:auto;"><table style="width:100%;border-collapse:collapse;font-size:14px;">'
    + '<thead><tr style="background:var(--n700);color:var(--s300);">'
    + '<th style="padding:10px 14px;text-align:left;">Company</th>'
    + '<th style="padding:10px 14px;text-align:left;">Trade</th>'
    + '<th style="padding:10px 14px;text-align:left;">City</th>'
    + '<th style="padding:10px 14px;text-align:left;">Status</th>'
    + '<th style="padding:10px 14px;text-align:left;">Plan</th>'
    + '<th style="padding:10px 14px;text-align:left;">Actions</th>'
    + '</tr></thead><tbody>'
    + providers.map(function(p){
        var statusBadge = p.status==='pending'
          ? '<span class="badge badge-yellow" style="font-size:11px;">Pending</span>'
          : p.claimed ? '<span class="badge badge-green" style="font-size:11px;">Claimed</span>'
          : '<span class="badge badge-navy" style="font-size:11px;">Unclaimed</span>';
        return '<tr style="border-top:1px solid var(--n500);">'
          + '<td style="padding:10px 14px;"><div style="font-weight:600;color:white;">' + p.companyName + '</div><div style="font-size:12px;color:var(--s400);">' + (p.email||'') + '</div></td>'
          + '<td style="padding:10px 14px;"><span class="badge badge-orange" style="font-size:11px;">' + p.tradeType + '</span></td>'
          + '<td style="padding:10px 14px;color:var(--s300);">' + ((p.serviceAreas||[])[0]||'—') + '</td>'
          + '<td style="padding:10px 14px;">' + statusBadge + '</td>'
          + '<td style="padding:10px 14px;"><span class="badge ' + (p.plan==='pro'||p.plan==='enterprise'?'badge-orange':'badge-navy') + '" style="font-size:11px;">' + (p.plan||'free') + '</span></td>'
          + '<td style="padding:10px 14px;"><div style="display:flex;gap:6px;flex-wrap:wrap;">'
          + (p.status==='pending' ? '<button class="btn btn-sm" style="background:rgba(34,197,94,0.15);color:#22C55E;border:1px solid rgba(34,197,94,0.3);" onclick="adminApproveProvider(\'' + p.id + '\')">Approve</button>' : '')
          + '<button class="btn btn-sm btn-navy" onclick="adminOpenEdit2(\'' + p.id + '\')">Edit</button>'
          + '<button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteProvider(\'' + p.id + '\')">Remove</button>'
          + '</div></td>'
          + '</tr>';
      }).join('')
    + '</tbody></table></div>';
}

function adminFilterListings2() {
  var q  = (document.getElementById('adminListingSearch')? document.getElementById('adminListingSearch').value : '').toLowerCase();
  var st = document.getElementById('adminListingStatusFilter') ? document.getElementById('adminListingStatusFilter').value : '';
  var filtered = App.providers.slice();
  if (q)  filtered = filtered.filter(function(p){ return p.companyName.toLowerCase().includes(q)||p.tradeType.toLowerCase().includes(q); });
  if (st) filtered = filtered.filter(function(p){ return p.status===st; });
  var el = document.getElementById('adminListingsTable2');
  if (el) el.innerHTML = renderAdminListingsTable2(filtered);
}

function adminApproveProvider(pid) {
  var idx = App.providers.findIndex(function(p){ return p.id===pid; });
  if (idx<0) return;
  App.providers[idx].status = 'active';
  App.providers[idx].claimed = true;
  saveProviders();
  renderAdmin();
  showToast('Listing approved and activated.','success');
  var prov = App.providers[idx];
  if (prov.email) {
    fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'application_approved',email:prov.email,data:{name:prov.contactName||prov.companyName,company:prov.companyName,trade:prov.tradeType,city:(prov.serviceAreas||[])[0]||'',plan:prov.plan||'Free'}})}).catch(function(){});
  }
}

function adminRejectProvider(pid) {
  var reason = prompt('Reason for rejection (optional):') || '';
  var idx = App.providers.findIndex(function(p){ return p.id===pid; });
  if (idx<0) return;
  var prov = App.providers[idx];
  App.providers.splice(idx,1);
  saveProviders();
  renderAdmin();
  showToast('Listing rejected and removed.','error');
  if (prov.email) {
    fetch('/api/send-email',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({type:'application_rejected',email:prov.email,data:{name:prov.contactName||prov.companyName,company:prov.companyName,reason:reason}})}).catch(function(){});
  }
}

function adminChangePlan(pid, plan) {
  var idx = App.providers.findIndex(function(p){ return p.id===pid; });
  if (idx<0) return;
  App.providers[idx].plan = plan;
  saveProviders();
  showToast('Plan updated to ' + plan + '.','success');
}

function adminMarkInquiryRead(id) {
  var idx = App.inquiries.findIndex(function(i){ return i.id===id; });
  if (idx<0) return;
  App.inquiries[idx].status = 'read';
  saveInquiries();
  var el = document.getElementById('inq_'+id);
  if (el) el.style.borderColor = 'var(--n500)';
  showToast('Marked as read.','success');
}

function adminDeleteInquiry(id) {
  if (!confirm('Delete this inquiry?')) return;
  App.inquiries = App.inquiries.filter(function(i){ return i.id!==id; });
  saveInquiries();
  var el = document.getElementById('inq_'+id);
  if (el) el.remove();
  showToast('Inquiry deleted.','success');
}

async function adminSendReply(inquiryId, toEmail, toName) {
  var txt = document.getElementById('replyText_'+inquiryId);
  if (!txt || !txt.value.trim()) { showToast('Please enter a reply message.','error'); return; }
  var message = txt.value.trim();
  try {
    await fetch('/api/contact', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name:'BookYourTrades Team', email:toEmail, subject:'Re: Your Inquiry', message: message })
    });
    // Also send via send-email for branded template
    await fetch('/api/send-email', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        type:'admin_alert', email:toEmail,
        data:{ subject:'Re: Your BookYourTrades Inquiry — ' + toName, details:{ Reply:message } }
      })
    });
  } catch(e) {}
  var idx = App.inquiries.findIndex(function(i){ return i.id===inquiryId; });
  if (idx>=0) { App.inquiries[idx].replied=true; App.inquiries[idx].status='read'; saveInquiries(); }
  showToast('Reply sent to ' + toEmail,'success');
  renderAdmin();
}

function adminDeleteJobPost(id) {
  if (!confirm('Remove this job posting?')) return;
  App.jobPostings = (App.jobPostings||[]).filter(function(j){ return j.id!==id; });
  localStorage.setItem('to_jobpostings', JSON.stringify(App.jobPostings));
  renderAdmin();
  showToast('Job posting removed.','success');
}

function adminRenderBlogList() {
  var posts = getBlogPosts();
  if (!posts.length) return '<div style="color:var(--s400);padding:40px;text-align:center;">No blog posts yet.</div>';
  return posts.map(function(p){
    return '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:8px;padding:16px 20px;margin-bottom:10px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      + '<div style="flex:1;min-width:0;">'
      + '<div style="font-weight:700;color:white;margin-bottom:3px;">' + p.title + '</div>'
      + '<div style="font-size:12px;color:var(--s400);">' + (p.category||'') + ' &bull; ' + (p.date||'') + ' &bull; ' + (p.readTime||'') + '</div>'
      + '</div>'
      + '<div style="display:flex;gap:8px;flex-wrap:wrap;">'
      + '<button class="btn btn-sm btn-navy" onclick="adminOpenBlogForm(\'' + p.slug + '\')">Edit</button>'
      + '<button class="btn btn-sm" style="background:#4D1A1A;color:#F08080;border:1px solid #6D2A2A;" onclick="adminDeleteBlogPost(\'' + p.slug + '\')">Delete</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

function adminDeleteBlogPost(slug) {
  if (!confirm('Delete this blog post?')) return;
  var posts = getBlogPosts().filter(function(p){ return p.slug!==slug; });
  saveBlogPosts(posts);
  var el = document.getElementById('adminBlogList');
  if (el) el.innerHTML = adminRenderBlogList();
  showToast('Post deleted.','success');
}

function adminOpenBlogForm(slug) {
  var wrap = document.getElementById('adminBlogFormWrap');
  if (!wrap) return;
  var post = slug ? getBlogPosts().find(function(p){ return p.slug===slug; }) : null;
  wrap.style.display = 'block';
  wrap.innerHTML =
    '<div style="background:var(--n700);border:1px solid var(--n500);border-radius:10px;padding:28px;margin-top:20px;">'
    + '<h3 style="font-size:18px;color:white;margin-bottom:20px;">' + (slug?'Edit':'New') + ' Blog Post</h3>'
    + '<form onsubmit="saveBlogPostForm(event,\'' + (slug||'') + '\')">'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Title *</label><input class="form-control" name="title" value="' + (post?post.title:'') + '" required /></div>'
    + '<div class="form-group"><label class="form-label">Category</label><input class="form-control" name="category" value="' + (post?post.category||'':'') + '" placeholder="e.g. Hiring Guides" /></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Author</label><input class="form-control" name="author" value="' + (post?post.author||'BookYourTrades':'BookYourTrades') + '" /></div>'
    + '<div class="form-group"><label class="form-label">Read Time</label><input class="form-control" name="readTime" value="' + (post?post.readTime||'5 min read':'5 min read') + '" /></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">Excerpt *</label><textarea class="form-control" name="excerpt" style="min-height:80px;" required>' + (post?post.excerpt||'':'') + '</textarea></div>'
    + '<div class="form-group"><label class="form-label">Full Body (HTML OK)</label><textarea class="form-control" name="body" style="min-height:200px;">' + (post?post.body||'':'') + '</textarea></div>'
    + '<div style="display:flex;gap:10px;margin-top:8px;">'
    + '<button type="submit" class="btn btn-orange">Save Post</button>'
    + '<button type="button" class="btn btn-navy" onclick="document.getElementById(\'adminBlogFormWrap\').style.display=\'none\'">Cancel</button>'
    + '</div>'
    + '</form>'
    + '</div>';
  wrap.scrollIntoView({behavior:'smooth', block:'start'});
}

function adminOpenEdit2(pid) {
  var p = pid ? App.providers.find(function(x){ return x.id===pid; }) : null;
  var container = document.getElementById('adminEditFormContainer');
  if (!container) return;
  var tradeOpts = TRADE_TYPES.map(function(t){ return '<option ' + (p&&t===p.tradeType?'selected':'') + '>' + t + '</option>'; }).join('');
  var yrOpts = ['Under 1 year','1-2 years','3-5 years','6-10 years','11-20 years','20+ years'].map(function(y){ return '<option ' + (p&&y===p.yearsInBusiness?'selected':'') + '>' + y + '</option>'; }).join('');
  container.innerHTML =
    '<div id="adminEditAlert"></div>'
    + '<form onsubmit="adminSaveEdit2(event,\'' + (pid||'') + '\')">'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Company Name</label><input class="form-control" name="companyName" value="' + (p?p.companyName:'') + '" required /></div>'
    + '<div class="form-group"><label class="form-label">Trade Type</label><select class="form-control" name="tradeType">' + tradeOpts + '</select></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Contact Name</label><input class="form-control" name="contactName" value="' + (p?p.contactName||'':'') + '" /></div>'
    + '<div class="form-group"><label class="form-label">Email</label><input class="form-control" type="email" name="email" value="' + (p?p.email||'':'') + '" /></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">Phone</label><input class="form-control" type="tel" name="phone" value="' + (p?p.phone||'':'') + '" /></div>'
    + '<div class="form-group"><label class="form-label">Website</label><input class="form-control" type="url" name="website" value="' + (p?p.website||'':'') + '" /></div>'
    + '</div>'
    + '<div class="form-row">'
    + '<div class="form-group"><label class="form-label">License Number</label><input class="form-control" name="licenseNumber" value="' + (p?p.licenseNumber||'':'') + '" /></div>'
    + '<div class="form-group"><label class="form-label">Status</label><select class="form-control" name="status"><option ' + (!p||p.status==='active'?'selected':'') + ' value="active">Active</option><option ' + (p&&p.status==='pending'?'selected':'') + ' value="pending">Pending</option></select></div>'
    + '</div>'
    + '<div class="form-group"><label class="form-label">Certifications (comma separated)</label><input class="form-control" name="certifications" value="' + (p?(p.certifications||[]).join(', '):'') + '" /></div>'
    + '<div class="form-group"><label class="form-label">Description</label><textarea class="form-control" name="description" style="min-height:100px;">' + (p?p.description||'':'') + '</textarea></div>'
    + '<div class="form-group"><label class="form-label">Service Areas (comma separated)</label><input class="form-control" name="serviceAreas" value="' + (p?(p.serviceAreas||[]).join(', '):'') + '" /></div>'
    + '<div class="form-row" style="margin-top:8px;">'
    + '<div class="form-group"><label class="form-label">Claimed?</label><select class="form-control" name="claimed"><option value="true" ' + (p&&p.claimed?'selected':'') + '>Yes — Claimed</option><option value="false" ' + (!p||!p.claimed?'selected':'') + '>No — Unclaimed</option></select></div>'
    + '<div class="form-group"><label class="form-label">Featured?</label><select class="form-control" name="featured"><option value="true" ' + (p&&p.featured?'selected':'') + '>Yes — Featured</option><option value="false" ' + (!p||!p.featured?'selected':'') + '>No</option></select></div>'
    + '<div class="form-group"><label class="form-label">Plan</label><select class="form-control" name="plan"><option value="free" ' + (!p||!p.plan||p.plan==='free'?'selected':'') + '>Free</option><option value="pro" ' + (p&&p.plan==='pro'?'selected':'') + '>Pro</option><option value="enterprise" ' + (p&&p.plan==='enterprise'?'selected':'') + '>Enterprise</option></select></div>'
    + '</div>'
    + '<div style="display:flex;gap:10px;margin-top:8px;">'
    + '<button type="submit" class="btn btn-orange">' + (pid?'Save Changes':'Add Listing') + '</button>'
    + '<button type="button" class="btn btn-navy" onclick="closeAdminEdit()">Cancel</button>'
    + '</div>'
    + '</form>';
  document.getElementById('adminEditModal').style.display = 'block';
}

function adminSaveEdit2(e, pid) {
  e.preventDefault();
  var data = {};
  var fd = new FormData(e.target);
  fd.forEach(function(v, k){ data[k] = v; });
  data.claimed  = data.claimed  === 'true';
  data.featured = data.featured === 'true';
  data.certifications = data.certifications ? data.certifications.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  data.serviceAreas   = data.serviceAreas   ? data.serviceAreas.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : [];
  if (pid) {
    var idx = App.providers.findIndex(function(p){ return p.id===pid; });
    if (idx<0) return;
    App.providers[idx] = Object.assign({}, App.providers[idx], data);
  } else {
    var newId = 'p_' + Date.now();
    App.providers.push(Object.assign({id:newId, rating:0, reviewCount:0, requestCount:0, logoData:null, password:'', source:'admin', province:'ON'}, data));
  }
  saveProviders();
  closeAdminEdit();
  renderAdmin();
  showToast(pid ? 'Listing updated.' : 'Listing added.','success');
}

function adminSaveSetting(key, val) {
  localStorage.setItem('byt_' + key, String(val));
  showToast('Setting saved.','success');
}

function adminExportData() {
  var blob = new Blob([JSON.stringify({providers:App.providers,users:App.users,clients:App.clients,inquiries:App.inquiries},null,2)],{type:'application/json'});
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'bookyourtrades_export_' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

function adminClearInquiries() {
  if (!confirm('Delete all inquiries?')) return;
  App.inquiries = [];
  saveInquiries();
  renderAdmin();
  showToast('All inquiries cleared.','success');
}

function adminHardReset() {
  localStorage.clear();
  sessionStorage.clear();
  location.reload();
}
