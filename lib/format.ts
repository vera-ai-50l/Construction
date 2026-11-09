// Plain formatters, safe on both server and client.
export const gbp = (n: number, d = 0) => '£' + n.toLocaleString('en-GB', { minimumFractionDigits: d, maximumFractionDigits: d })
