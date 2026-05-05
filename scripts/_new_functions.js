/* ============================================================
   CONTACT FORM HANDLER
============================================================ */
async function handleContactSubmit(e) {
  e.preventDefault();
  var form = e.target;
  var btn  = document.getElementById('contactSubmitBtn');
  var alertEl = document.getElementById('contactAlert');
  var fd = new FormData(form);
  var body = {
    name:    fd.get('name'),
    email:   fd.get('email'),
    phone:   fd.get('phone') || '',
    subject: fd.get('subject') || 'General Inquiry',
    message: fd.get('message'),
  };

  btn.disabled = true;
  btn.textContent = 'Sending...';
  alertEl.innerHTML = '';

  // Store locally
  var inq = Object.assign({
    id: 'inq_' + Date.now(),
    createdAt: new Date().toISOString(),
    status: 'new',
    replied: false,
  }, body);
  App.inquiries = App.inquiries || [];
  App.inquiries.unshift(inq);
  saveInquiries();

  try {
    await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch(_) {}

  alertEl.innerHTML = '<div class="alert alert-success" style="margin-bottom:20px;">&#10003; Message sent! We\'ll respond to ' + body.email + ' within 1&#8211;2 business days.</div>';
  form.reset();
  btn.disabled = false;
  btn.textContent = 'Send Message →';
}

/* ============================================================
   AVAILABILITY — PERSIST TO localStorage
============================================================ */
function saveAvailability() {
  var days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  var avail = {};
  days.forEach(function(d) {
    var cb    = document.getElementById('av_' + d);
    var selEl = document.getElementById('hrs_' + d);
    var sels  = selEl ? selEl.querySelectorAll('select') : [];
    avail[d] = {
      available: cb ? cb.checked : false,
      open:  sels[0] ? sels[0].value : '8:00 AM',
      close: sels[1] ? sels[1].value : '5:00 PM',
    };
  });
  if (App.currentUser && App.currentUser.providerId) {
    var idx = App.providers.findIndex(function(p){ return p.id === App.currentUser.providerId; });
    if (idx >= 0) { App.providers[idx].availability = avail; saveProviders(); }
  }
  showToast('Availability saved!', 'success');
}

/* ============================================================
   MY LISTING — SAVE OWN PROFILE FROM DASHBOARD
============================================================ */
function saveMyListing(e) {
  e.preventDefault();
  if (!App.currentUser) return;
  var idx = App.providers.findIndex(function(p){ return p.id === App.currentUser.providerId; });
  if (idx < 0) return;
  var fd = new FormData(e.target);
  var data = {};
  fd.forEach(function(v, k){ data[k] = v; });
  data.serviceAreas   = data.serviceAreas   ? data.serviceAreas.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : (App.providers[idx].serviceAreas || []);
  data.certifications = data.certifications ? data.certifications.split(',').map(function(s){ return s.trim(); }).filter(Boolean) : (App.providers[idx].certifications || []);
  if (data.newPassword && data.newPassword.length >= 6) {
    App.providers[idx].password = data.newPassword;
    var uidx = App.users.findIndex(function(u){ return u.providerId === App.providers[idx].id; });
    if (uidx >= 0) App.users[uidx].password = data.newPassword;
    saveUsers();
  }
  delete data.newPassword;
  App.providers[idx] = Object.assign({}, App.providers[idx], data);
  saveProviders();
  var alertEl = document.getElementById('myListingAlert');
  if (alertEl) alertEl.innerHTML = '<div class="alert alert-success" style="margin-bottom:16px;">&#10003; Listing saved successfully!</div>';
  showToast('Listing updated!', 'success');
}
