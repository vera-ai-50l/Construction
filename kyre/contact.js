// Kyre contact details. Fill these in and every "Book a call" button on the page uses them.
// An empty value hides that option.
//  - calendar: a booking link (Google Calendar appointment page, Cal.com, Calendly)
//  - email:    the address replies and enquiries go to
//  - whatsapp: number in international format, digits only, e.g. "447700900123"
var KYRE_CONTACT = {
  calendar: "",
  email: "",
  whatsapp: ""
};

(function () {
  var c = KYRE_CONTACT;
  var msg = "Hi Kyre, I'd like to talk about pay-per-lead outreach for our hiring.";
  var actions = [];
  if (c.calendar) actions.push({ href: c.calendar, label: "Book a 15-minute call", cls: "btn btn-accent", ext: true });
  if (c.email) actions.push({
    href: "mailto:" + c.email + "?subject=" + encodeURIComponent("Pay-per-lead outreach") + "&body=" + encodeURIComponent(msg + "\n\nCompany:\nWho we want to reach:\n"),
    label: "Email us", cls: actions.length ? "btn btn-ghost" : "btn btn-accent"
  });
  if (c.whatsapp) actions.push({
    href: "https://wa.me/" + c.whatsapp + "?text=" + encodeURIComponent(msg),
    label: "WhatsApp us", cls: actions.length ? "btn btn-ghost" : "btn btn-accent", ext: true
  });

  var box = document.getElementById("contact-actions");
  if (!box) return;
  if (!actions.length) {
    box.innerHTML = '<p class="contact-note">Contact details coming soon.</p>';
    return;
  }
  box.innerHTML = actions.map(function (a) {
    return '<a class="' + a.cls + '" href="' + a.href + '"' + (a.ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + a.label + "</a>";
  }).join("");

  // Every "Book a call" button goes straight to the first option.
  var primary = actions[0];
  document.querySelectorAll(".js-book").forEach(function (b) {
    b.setAttribute("href", primary.href);
    if (primary.ext) { b.setAttribute("target", "_blank"); b.setAttribute("rel", "noopener noreferrer"); }
  });
})();
