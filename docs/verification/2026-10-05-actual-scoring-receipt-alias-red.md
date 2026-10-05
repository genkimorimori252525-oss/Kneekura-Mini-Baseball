# Actual scorer receipt-alias review regression cut

Test-only child of immutable implementation checkpoint
`924f884cfe46e0404d4594425200f7bf5eb3b64f`. No production repair is included.

The independent review found ownership claims omitted from the staging
`originalReceipt.activation/result`, actual closure
`expectedOfficial.activation/result` and `official.activation/result`, and
original application `activation/result` JSON mirrors.

Thirty-two focused cases insert a foreign rival with a single target identity
claim in one omitted branch. Each branch tests `applicationId` and `closureId`,
with ordinary raw JSON and a duplicate escaped key where JSON.parse would
retain only the later foreign value. The foreign row is deliberately not a
valid domain archive: discovery must reject its relevant ownership claim
before any attempt to decode it. The staging foreign Source envelope is valid.

The expected RED is the ownership rejection assertion failing because the
frozen implementation overlooks the rival claim. At preparation time these
cases are unexecuted; no behavioral RED or guard clearance is claimed. The
other 36 declared admission cases will be excluded from this targeted run.
Original physical and review projection fixtures remain substituted; this is
an ownership-census test, not genuine original safe-fair acceptance.
