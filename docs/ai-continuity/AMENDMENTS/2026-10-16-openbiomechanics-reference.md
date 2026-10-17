# Reference data change — latest direct human instruction

Received 2026-10-16 JST. The human supplied https://github.com/drivelineresearch/openbiomechanics and instructed: use real hitting/pitching data from here, no longer use MMD as the reference, select only elements required by this game, no hitting/pitching body form needed, download the data now for later use. Existing full /goal implementation continues; this does not request immediate wholesale motor replacement.

This supersedes the previous upper Miku right⑤ reference requirement for future work. Original MMD files, research outputs and maker remain preserved as historical experiments. Do not further calibrate gameplay against MMD. Do not claim OpenBiomechanics data are integrated merely because downloaded.

Actual selection: fixed Git commit44b98dae05cceb016f080ab39d105c85b8639084, dataset-v1 hitting/pitching landmarks99MB, all upstream SHA256/asset digest and zipCRC matched; original Git blobs23 matched. Selected unmodified columns: bat reference hand/sweetspot/time/contact677swings469377rows98athletes; hand/wrist/time/BR411pitches247709rows100athletes. Metadata, POI/HitTrax, data dictionaries, marker model definitions and licenses saved. No body-angle/force/energy/CV/binary/rawC3D downloads. Hit coordinates have5missingframes, unchanged; pitching selectednumeric columns finite. No input resampling/imputation/axis conversion. No ballspin or exact ballrelease vector inferred. CC BY-NC-SA4.0 plus upstream exclusion terms preserved; separateMIT code license retained.

User-facing location: outputs/参考データ/openbiomechanics/README_採用方針.txt. Raw data kept separate from software source ZIP. Download receipt e35f265... and selection receipt d2a6a4... in verification-receipts. Both PASS prove download/columnselection/integrity only.

This document records a direct chat instruction, not machine Charter approval. Strict external approval remains HOLD; no receipt manufactured.
