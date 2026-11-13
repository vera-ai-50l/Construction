// Fictional projects in the markup the live MahaRERA search uses (checked Nov 2026).
// Menu and footer text ("Extension", "Developer Wise") is included on purpose: it must not leak into cards.
export function card({ reg, project, promoter, place, district, pincode = '400601', modified, ext = false, id = 1 }) {
  return `<div class="row shadow p-3 mb-5 bg-body rounded">
    <div class="col-xl-4">
      <p class="p-0"># ${reg}</p>
      <h4 class="title4"><strong>${project}</strong></h4>
      <p class="darkBlue bold ">${promoter}</p>
      <ul class="listingList"><li><a href="https://www.google.com/maps/search/?api=1&amp;query=19.2,72.9"><em class="fa-solid fa-location-dot"></em> ${place} </a></li>
        <li><a href="https://www.google.com/maps/dir/?api=1&amp;destination=19.2,72.9" class="targetBlankLink">Find Route</a></li></ul>
    </div>
    <div class="col-xl-6">
      <div class="row">
        <div class="col-xl-4"><div class="greyColor">State</div><p>MAHARASHTRA</p></div>
        <div class="col-xl-4"><div class="greyColor">Pincode</div><p>${pincode}</p></div>
        <div class="col-xl-4"><div class="greyColor">Certificate</div><a href="#" title="View Certificate" data-qstr-flag="DocProjectCert" data-qstr="${id}" class="btnBdr click-modal"><i class="fa fa-eye"></i></a></div>
      </div>
      <div class="row">
        <div class="col-xl-4"><div class="greyColor">District</div><p>${district}</p></div>
        <div class="col-xl-4"><div class="greyColor">Last Modified</div><p>${modified}</p></div>
        <div class="col-xl-4"><div class="greyColor">Extension Certificate</div>${ext ? `<a href="#" title="View Extension Certificate" data-qstr-flag="DocProjectExtCert" data-qstr="${id}" class="btnBdr click-modal"><i class="fa fa-eye"></i></a>` : 'N/A'}</div>
      </div>
    </div>
    <div class="col-xl-2 divider">
      <div class="greyColor">Application</div>
      <ul class="listingList"><li><a href="https://maharerait.maharashtra.gov.in/public/project/view/${id}" title="View Details" class="viewLink">View Details</a></li>
      <li><a href="https://maharerait.maharashtra.gov.in/public/project/view/${id}?isOriginal=true" class="viewLink">View Original Application</a></li></ul>
    </div>
  </div>`
}

export function page(cards, { total, pages, current = 1 } = {}) {
  return `<html><body>
  <ul class="menu"><li>Registration</li><li>Correction</li><li>Extension</li><li>FAQs</li></ul>
  <h2>Registered Projects</h2><div>MAHARASHTRA</div>
  <div>Showing Final ${total ?? cards.length} Result</div>
  <div class="container">${cards.map(card).join('\n')}</div>
  <div class="pagination">Pages ${current} of ${pages ?? 1} Go to page: <select><option>1</option></select></div>
  <footer><p>Developer Wise Report</p><p>Promoter Wise Complaints</p></footer>
  </body></html>`
}
