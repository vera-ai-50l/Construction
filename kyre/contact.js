// Kyre contact details. Every "Book a call" button on the page opens a small window with these options.
// An empty value hides that option.
//  - calendar: a booking link (Google Calendar appointment page, Cal.com, Calendly)
//  - email:    the address enquiries go to
//  - whatsapp: number in international format, digits only, e.g. "919804142190"
var KYRE_CONTACT = {
  calendar: "",
  email: "aditya@trykyre.com",
  whatsapp: "919804142190"
};

(function () {
  var c = KYRE_CONTACT;
  var waText = "Hi Kyre, I'd like to talk about pay-per-lead outreach for our hiring.\nCompany: \nWho we want to reach: ";
  var mailBody = "Hi Kyre,\n\nI'd like to talk about pay-per-lead outreach for our hiring.\n\nCompany:\nWho we want to reach:\nPhone:\n";

  var options = [];
  if (c.calendar) options.push({
    href: c.calendar, title: "Book a 15-minute call", note: "Pick a time that suits you.", icon: "cal"
  });
  if (c.whatsapp) options.push({
    href: "https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent(waText),
    title: "Message us on WhatsApp", note: "Opens WhatsApp with the message written. Just press send.", icon: "wa"
  });
  if (c.email) options.push({
    href: "mailto:" + c.email + "?subject=" + encodeURIComponent("Pay-per-lead outreach") + "&body=" + encodeURIComponent(mailBody),
    title: "Write to us", note: c.email, icon: "mail"
  });

  var ICONS = {
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.8z"/><path d="M9.2 8.6c.2 2.6 3.1 5.5 5.7 5.8l1.1-1.2-1.8-1-1 .8c-1-.4-2.1-1.5-2.5-2.5l.8-1-1-1.8z"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M4 7l8 6 8-6"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8"/></svg>'
  };

  function optionHTML(o, i) {
    var ext = o.href.indexOf("mailto:") === 0 ? "" : ' target="_blank" rel="noopener noreferrer"';
    return '<a class="opt' + (i === 0 ? " primary" : "") + '" href="' + o.href + '"' + ext + ">" +
      '<span class="opt-ic">' + ICONS[o.icon] + "</span>" +
      '<span class="opt-tx"><b>' + o.title + "</b><span>" + o.note + "</span></span>" +
      '<span class="opt-go">' + ICONS.arrow + "</span></a>";
  }

  // Contact section at the bottom of the page: the same options, inline.
  var box = document.getElementById("contact-actions");
  if (box) {
    box.innerHTML = options.length
      ? '<div class="opts inline">' + options.map(optionHTML).join("") + "</div>"
      : '<p class="contact-note">Contact details coming soon.</p>';
  }
  if (!options.length) return;

  // The booking window.
  var dlg = document.createElement("div");
  dlg.className = "book";
  dlg.hidden = true;
  dlg.innerHTML =
    '<div class="book-panel" role="dialog" aria-modal="true" aria-labelledby="book-title">' +
      '<div class="book-head"><div><h2 id="book-title">Talk to Kyre</h2>' +
      "<p>A 15-minute chat to agree who to reach and what you'd pay per lead.</p></div>" +
      '<button type="button" class="book-x" aria-label="Close">&times;</button></div>' +
      '<div class="opts">' + options.map(optionHTML).join("") + "</div>" +
      '<p class="book-foot">We reply within one working day.</p>' +
    "</div>";
  document.body.appendChild(dlg);

  var last = null;
  function open(e) {
    if (e) e.preventDefault();
    last = document.activeElement;
    dlg.hidden = false;
    document.documentElement.style.overflow = "hidden";
    var first = dlg.querySelector(".opt");
    if (first) first.focus();
  }
  function close() {
    dlg.hidden = true;
    document.documentElement.style.overflow = "";
    if (last && last.focus) last.focus();
  }
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg || e.target.closest(".book-x")) close();
  });
  document.addEventListener("keydown", function (e) {
    if (!dlg.hidden && e.key === "Escape") close();
  });
  document.querySelectorAll(".js-book").forEach(function (b) { b.addEventListener("click", open); });
})();
