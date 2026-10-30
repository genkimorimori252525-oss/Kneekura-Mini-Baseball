# V3 free Source metadata Native proof

This helper is prepared for a closed immutable snapshot supplied by the physical
Source owner. It is not permission to operate on the running branch database.
The five metadata kinds have calculation tests; this experiment admits only one
`defender_observation_v1`. It grants no motor, possession, official or game credit.

`v3-metadata-entry.ts` takes `manifest.json output-directory stage [unique-namespace]`.
The default new namespace is `v3-metadata-clock-v1`; never reuse the fixed failed
`v3-metadata-proof` proposal namespace. The manifest
must contain absolute `databasePath` / `sourceMapPath`, their SHA-256 strings
`databaseHash` / `sourceMapHash`, and original owner references `rootReference`,
`stepReference`, `viewReference`. The Source Map is an array of `[id, source]`.
Capturing these values is not owner authentication; `prepare` independently
rederives the original root/step and historical view on a private copy.

Build with existing esbuild, from the repository root:

```powershell
node --input-type=module -e "import {build} from 'esbuild'; await build({entryPoints:['tools/verification/aero-ground-samepa/v3-metadata-entry.ts'],outfile:'../native-v3-metadata-entry.mjs',bundle:true,platform:'node',format:'esm',packages:'external',target:'node26'});"
```

Run each stage in its own Node process, recording stdout/stderr and exit code:

1. `prepare`: hash-check immutable inputs, copy them with exclusive creation,
   original-owner root/step/historical-view read, pin exact cursor and table rows.
2. `advance`: when the step is not yet represented in its lifecycle, adopt that
   exact reference through original prefix/TOTAL/view owners. No step replay or
   new physical advancement is requested.
3. `calibrate`: authenticate the prior view's original 32 calibrations. The nine
   observation routes use the explicit versioned clock-projection Source binding
   original nominal/effective/field references. Scale only the two refresh tick
   intervals and the memory clock; the original owner rederives both projected
   inputs. Keep all other routes' prior values. This is unit conversion, not
   measured calibration, ability improvement or old Source re-admission.
4. `admit`: use the current view's original observation calibration, explicit
   synthetic ball-directed gaze and exact Source cursor to admit one observation.
5. `reopen`: fresh process, no accepted-Source authority callback, original owner
   read of the persisted metadata and original root/step. No new acceptance call.

If the supplied view already covers the step, omit `advance`; if its complete
observation calibrations already exist, omit `calibrate`. Do not omit original
authentication or manufacture a new view/calibration reference to bypass failure.

Each phase checks immutable input hashes and all original Source Map entries.
All preexisting SQL rows and schema must remain equal, except admission's one
precisely checked operation-head CAS. Metadata adds one field-step archive row;
its field/timeline/evaluation tick/solver evidence must equal the original step.
The kernel is evaluated at its original `elapsedSeconds` and `sourceSide`, never
at `evaluationTick / ticksPerSecond`. Fractional ground or rebound cuts therefore
remain unchanged.

Every stage closes all owners/readers before recording hashes and saves a
standalone `VACUUM INTO` checkpoint plus its pinned Source Map. Checkpoint rows
and schema must equal the completed stage; WAL-only commits are therefore not
mistaken for a complete main-file copy. Preserve each closed boundary before the
next stage so corrected calibration does not require repeating lifecycle work.

Stage baselines survive interrupted acceptance. Failure receipts are kept under
unique names; a failure or pending stage is not a passing experiment. A successful
`admit` still requires the separate `reopen` phase. The final receipt explicitly
states that metadata lifecycle advancement and LiveWork/rules are unverified.
The current view row is preserved; after the metadata head advances, its original
view is read historically rather than misrepresented as the new current head.

The first branch retained the original 1000-ticks/s nominal/effective values and
correctly failed against the 1000000-ticks/s V3 clock. Its closed checkpoint and
unadmitted proposal remain fixed separately. The new branch starts from the
original frozen V3 snapshot with new unique Sources. Its admission and cold reopen
remain pending until separately run; pure projection tests are not Native proof.
