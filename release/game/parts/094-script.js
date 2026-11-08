
var NativeContactRosterPanelV269 = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // work/line-drive-ui-v269-01/entry.mjs
  var entry_exports = {};
  __export(entry_exports, {
    watcher: () => watcher
  });

  // tools/native-contact-roster-json-v266.ts
  var fail = () => {
    throw Error("invalid V266 contact data");
  };
  var dangerous = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
  var limit = 1e5;
  var depthLimit = 64;
  var textLimit = 1e7;
  var byteLength = (text) => new TextEncoder().encode(text).byteLength;
  var dense = (value) => {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > limit) return false;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || keys[value.length] !== "length") return false;
    for (let i = 0; i < value.length; i++) {
      if (keys[i] !== String(i)) return false;
      const d = Object.getOwnPropertyDescriptor(value, String(i));
      if (!d || !d.enumerable || !("value" in d)) return false;
    }
    return true;
  };
  var assertInertWire = (root) => {
    const stack = [{ v: root, depth: 0 }], active = /* @__PURE__ */ new Set();
    let count = 0;
    const budget = limit * 6 + 4;
    while (stack.length) {
      const { v, depth, exit } = stack.pop();
      if (exit) {
        active.delete(v);
        continue;
      }
      if (++count > budget || depth > depthLimit * 3 + 4) fail();
      if (Array.isArray(v)) {
        if (active.has(v) || !dense(v)) fail();
        if (count + stack.length + v.length + 1 > budget) fail();
        active.add(v);
        stack.push({ v, depth, exit: true });
        for (let i = v.length - 1; i >= 0; i--) stack.push({ v: Object.getOwnPropertyDescriptor(v, String(i)).value, depth: depth + 1 });
      } else if (v !== null && typeof v !== "string" && typeof v !== "number" && typeof v !== "boolean") fail();
    }
  };
  function decodeContactNodeV266(input) {
    assertInertWire(input);
    let count = 0;
    const walk = (node, depth) => {
      if (++count > limit || depth > depthLimit || !Array.isArray(node)) return fail();
      const [tag, payload] = node;
      if (tag === "null" && node.length === 1) return null;
      if (tag === "undefined" && node.length === 1) return void 0;
      if (tag === "negative-zero" && node.length === 1) return -0;
      if (node.length !== 2) return fail();
      if (tag === "string" && typeof payload === "string" || tag === "boolean" && typeof payload === "boolean") return payload;
      if (tag === "number" && typeof payload === "string") {
        const n = Number(payload);
        if (!Number.isFinite(n) || String(n) !== payload) return fail();
        return n;
      }
      if (tag === "array" && Array.isArray(payload)) {
        if (payload.length > limit) return fail();
        return payload.map((v) => walk(v, depth + 1));
      }
      if (tag === "object" && Array.isArray(payload)) {
        if (payload.length > limit) return fail();
        const o = {}, keys = /* @__PURE__ */ new Set();
        for (const p of payload) {
          if (!Array.isArray(p) || p.length !== 2 || typeof p[0] !== "string" || dangerous.has(p[0]) || keys.has(p[0])) return fail();
          keys.add(p[0]);
          Object.defineProperty(o, p[0], { value: walk(p[1], depth + 1), enumerable: true, writable: true, configurable: true });
        }
        return o;
      }
      return fail();
    };
    return walk(input, 0);
  }
  var object = (v, keys) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) return fail();
    const o = v, expected = keys.split(" ");
    if (Object.keys(o).length !== expected.length || expected.some((k) => !Object.hasOwn(o, k))) return fail();
    return o;
  };
  var str = (v) => typeof v === "string" && v.length > 0 && v.trim() === v ? v : fail();
  var int = (v) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && !Object.is(v, -0) ? v : fail();
  var arr = (v) => Array.isArray(v) ? v : fail();
  var eq = (a, b) => {
    if (a !== b) fail();
  };
  var strings = (v) => arr(v).forEach(str);
  var hash = (v) => {
    if (v !== null && (typeof v !== "string" || !/^[0-9a-f]{64}$/.test(v))) fail();
  };
  var time = (v) => {
    const t = object(v, "season day sequence");
    int(t.season);
    int(t.day);
    int(t.sequence);
  };
  var scope = (v, career, player) => {
    const s = object(v, "careerId playerId");
    eq(s.careerId, career);
    eq(s.playerId, player);
  };
  var source = (v, career, player) => {
    if (v === null) return;
    const s = object(v, "careerId owner subjectId sourceKey revision snapshotId time");
    eq(s.careerId, career);
    eq(s.owner, "BATTING_CONTACT");
    eq(s.subjectId, player);
    str(s.sourceKey);
    int(s.revision);
    str(s.snapshotId);
    time(s.time);
  };
  function distribution(v, career, player, status, reasons2) {
    const d = object(v, "version boundary scope status reasons source inventoryHash totalContacts bandCount boundary25Count fraction contacts populationCoverage timeSemantics reference directionStatus physicsEffects modelAuthority");
    eq(d.version, "native-contact-distribution-v262");
    eq(d.boundary, "READ_ONLY_SUPPORTED_NATIVE_CONTACT_DISTRIBUTION");
    scope(d.scope, career, player);
    eq(d.status, status);
    strings(d.reasons);
    if (JSON.stringify(d.reasons) !== JSON.stringify(reasons2)) fail();
    source(d.source, career, player);
    hash(d.inventoryHash);
    eq(d.populationCoverage, "SUPPORTED_NATIVE_INVENTORY_ONLY");
    eq(d.timeSemantics, "AS_OF_LATEST_REGISTERED_CONTACT");
    eq(d.reference, "MLB_LA_GENERAL_GUIDELINE");
    eq(d.directionStatus, "UNASSESSED");
    eq(d.physicsEffects, "NONE");
    eq(d.modelAuthority, "NOT_USED");
    if (status === "UNKNOWN") {
      if (!d.reasons.length || [d.totalContacts, d.bandCount, d.boundary25Count, d.fraction, d.contacts].some((x) => x !== null)) fail();
      return;
    }
    if (status !== "OBSERVED" || d.reasons.length || d.source === null || d.inventoryHash === null) fail();
    const contacts = arr(d.contacts);
    int(d.totalContacts);
    int(d.bandCount);
    int(d.boundary25Count);
    if (!contacts.length || d.totalContacts !== contacts.length) fail();
    let band = 0, boundary = 0;
    let latest = null;
    const events = /* @__PURE__ */ new Set(), episodes = /* @__PURE__ */ new Set();
    for (const item of contacts) {
      const c = object(item, "eventId episodeId time launchAngleDeg label");
      const event = str(c.eventId), episode = str(c.episodeId);
      if (events.has(event) || episodes.has(episode)) fail();
      events.add(event);
      episodes.add(episode);
      time(c.time);
      if (latest === null || c.time.day > latest.day || c.time.day === latest.day && c.time.sequence > latest.sequence) latest = c.time;
      const a = c.launchAngleDeg;
      if (typeof a !== "number" || !Number.isFinite(a) || a < -90 || a > 90) fail();
      const label = a === 25 ? "BOUNDARY_25" : a >= 10 && a < 25 ? "LINE_DRIVE_BAND" : "OUTSIDE";
      eq(c.label, label);
      if (label !== "OUTSIDE") band++;
      if (label === "BOUNDARY_25") boundary++;
    }
    if (d.bandCount !== band || d.boundary25Count !== boundary || d.fraction !== band / contacts.length) fail();
    if (!latest || d.source.time.season !== latest.season || d.source.time.day !== latest.day || d.source.time.sequence !== latest.sequence) fail();
  }
  function validateContactRosterV264(v) {
    const p = object(v, "version boundary batch subjectLinks");
    eq(p.version, "native-contact-roster-export-v264");
    eq(p.boundary, "LOCAL_READ_ONLY_NATIVE_ROSTER_EXPORT");
    const b = object(p.batch, "version boundary careerId requestedRosterSnapshotId status reasons roster rows populationBoundary producerCoverage asOfSemantics directionStatus physicsEffects");
    eq(b.version, "native-contact-distribution-batch-v263");
    eq(b.boundary, "READ_ONLY_NATIVE_ROSTER_CONTACT_BATCH");
    const career = str(b.careerId);
    str(b.requestedRosterSnapshotId);
    strings(b.reasons);
    eq(b.populationBoundary, "EXPLICIT_GLOBAL_ROSTER_SNAPSHOT_ONLY");
    eq(b.producerCoverage, "SUPPORTED_NATIVE_INVENTORY_ONLY");
    eq(b.asOfSemantics, "ROSTER_CHECKPOINT_AND_LATEST_REGISTERED_CONTACT_AT_SAME_DB_SNAPSHOT");
    eq(b.directionStatus, "UNASSESSED");
    eq(b.physicsEffects, "NONE");
    if (b.rows === null) {
      if (b.status !== "UNKNOWN" || b.roster !== null || p.subjectLinks !== null || !b.reasons.length) fail();
      return;
    }
    const rows = arr(b.rows), links = arr(p.subjectLinks), r = object(b.roster, "snapshotId revision effectiveDay playerCount");
    eq(r.snapshotId, b.requestedRosterSnapshotId);
    int(r.revision);
    int(r.effectiveDay);
    int(r.playerCount);
    if (rows.length !== links.length || rows.length !== r.playerCount) fail();
    if (!rows.length) {
      if (b.status !== "UNKNOWN" || !b.reasons.length) fail();
      return;
    }
    if (b.reasons.length) fail();
    const ids = /* @__PURE__ */ new Set(), people = /* @__PURE__ */ new Set(), linkSources = /* @__PURE__ */ new Set();
    let all = true;
    rows.forEach((value, index) => {
      const row = object(value, "playerId status reasons distribution currentInventoryHash producerAvailability"), id = str(row.playerId);
      if (ids.has(id)) fail();
      ids.add(id);
      if (!["UNKNOWN", "OBSERVED"].includes(row.status)) fail();
      strings(row.reasons);
      hash(row.currentInventoryHash);
      if (row.status === "UNKNOWN") {
        all = false;
        if (!row.reasons.length) fail();
      } else if (row.reasons.length) fail();
      const l = object(links[index], "playerId identity");
      eq(l.playerId, id);
      if (row.distribution === null) {
        if (row.status !== "UNKNOWN" || l.identity !== null || row.currentInventoryHash !== null || row.producerAvailability !== null || row.reasons.length !== 1 || !["SUBJECT_LINK_MISSING", "SUBJECT_LINK_AMBIGUOUS"].includes(row.reasons[0])) fail();
        return;
      }
      const identity = object(l.identity, "careerId playerId personId sourceId");
      eq(identity.careerId, career);
      eq(identity.playerId, id);
      const person = str(identity.personId), linkSource = str(identity.sourceId);
      if (people.has(person) || linkSources.has(linkSource)) fail();
      people.add(person);
      linkSources.add(linkSource);
      const availability = object(row.producerAvailability, "physical_pitch_progress_actions pa_physical_v1_resolutions pa_initial_joint_v1_executions");
      Object.values(availability).forEach((x) => {
        if (x !== "PRESENT" && x !== "ABSENT") fail();
      });
      distribution(row.distribution, career, id, row.status, row.reasons);
      if (row.distribution.inventoryHash !== null) eq(row.currentInventoryHash, row.distribution.inventoryHash);
    });
    eq(b.status, all ? "OBSERVED_FOR_SNAPSHOT_ROSTER" : "PARTIAL");
  }
  function parseContactRosterV266(text) {
    if (typeof text !== "string" || text.length > textLimit || byteLength(text) > textLimit) fail();
    let root;
    try {
      root = JSON.parse(text);
    } catch {
      return fail();
    }
    if (!Array.isArray(root) || root.length !== 2 || root[0] !== "native-contact-roster-json-v266") return fail();
    const result = decodeContactNodeV266(root[1]);
    validateContactRosterV264(result);
    return { version: "native-contact-roster-parsed-v266", provenance: "NOT_AUTHENTICATED_BY_JSON", payload: result };
  }

  // tools/browser-bridge/native-contact-roster-view-v268.ts
  function prepareNativeContactRosterViewV268(text) {
    const parsed = parseContactRosterV266(text), b = parsed.payload.batch, links = parsed.payload.subjectLinks;
    return {
      version: "native-contact-roster-view-v268",
      provenance: parsed.provenance,
      populationBoundary: b.populationBoundary,
      producerCoverage: b.producerCoverage,
      asOfSemantics: b.asOfSemantics,
      careerId: b.careerId,
      rosterSnapshotId: b.requestedRosterSnapshotId,
      status: b.status,
      reasons: [...b.reasons],
      roster: b.roster === null ? null : { ...b.roster },
      rows: b.rows === null ? null : b.rows.map((row, index) => {
        const d = row.distribution, identity = links[index].identity;
        return {
          playerId: row.playerId,
          name: null,
          nameStatus: "UNAVAILABLE_IN_EXPORT",
          identity: identity === null ? null : { ...identity },
          status: row.status,
          reasons: [...row.reasons],
          currentInventoryHash: row.currentInventoryHash,
          producerAvailability: row.producerAvailability === null ? null : { ...row.producerAvailability },
          source: d?.source === null || d === null ? null : { ...d.source, time: { ...d.source.time } },
          reference: d?.reference ?? null,
          timeSemantics: d?.timeSemantics ?? null,
          totalContacts: d?.totalContacts ?? null,
          bandCount: d?.bandCount ?? null,
          boundary25Count: d?.boundary25Count ?? null,
          fraction: d?.fraction ?? null,
          contacts: d?.contacts === null || d === null ? null : d.contacts.map((contact) => ({ ...contact, time: { ...contact.time } }))
        };
      })
    };
  }

  // tools/browser-bridge/native-contact-roster-panel-v269.ts
  var reasons = {
    ROSTER_SNAPSHOT_NAMESPACE_ABSENT: "\u30ED\u30B9\u30BF\u30FC\u306E\u4FDD\u5B58\u9818\u57DF\u304C\u3042\u308A\u307E\u305B\u3093",
    ROSTER_SNAPSHOT_NOT_FOUND: "\u6307\u5B9A\u3055\u308C\u305F\u30ED\u30B9\u30BF\u30FC\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    SUBJECT_LINK_NAMESPACE_ABSENT: "\u4EBA\u7269\u30EA\u30F3\u30AF\u306E\u4FDD\u5B58\u9818\u57DF\u304C\u3042\u308A\u307E\u305B\u3093",
    EMPTY_ROSTER_SNAPSHOT: "\u6307\u5B9A\u30ED\u30B9\u30BF\u30FC\u306B\u9078\u624B\u304C\u3044\u307E\u305B\u3093",
    SUBJECT_LINK_MISSING: "\u4EBA\u7269\u30EA\u30F3\u30AF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093",
    SUBJECT_LINK_AMBIGUOUS: "\u4EBA\u7269\u30EA\u30F3\u30AF\u3092\u4E00\u610F\u306B\u7279\u5B9A\u3067\u304D\u307E\u305B\u3093",
    NO_REGISTERED_CONTACTS: "\u767B\u9332\u6E08\u307F\u306E\u63A5\u89E6\u8A18\u9332\u304C\u3042\u308A\u307E\u305B\u3093",
    INVENTORY_NOT_CAPTURED: "\u63A5\u89E6\u8A18\u9332\u306E\u53CE\u96C6\u304C\u5B8C\u4E86\u3057\u3066\u3044\u307E\u305B\u3093",
    INVENTORY_CHANGED_SINCE_CAPTURE: "\u53CE\u96C6\u5F8C\u306B\u63A5\u89E6\u8A18\u9332\u304C\u5909\u308F\u308A\u307E\u3057\u305F",
    UNRESOLVED_CONTACT_IDENTITY: "\u540C\u3058\u6253\u5E2D\u306E\u63A5\u89E6\u3092\u533A\u5225\u3067\u304D\u307E\u305B\u3093",
    PROJECTION_NOT_READY: "\u96C6\u8A08\u306E\u6E96\u5099\u304C\u6574\u3063\u3066\u3044\u307E\u305B\u3093",
    SNAPSHOT_INCONSISTENT: "\u53CE\u96C6\u8A18\u9332\u306E\u6574\u5408\u6027\u3092\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093",
    UNDEFINED_CONTACT_DIRECTION: "\u6253\u7403\u901F\u5EA6\u304B\u3089\u6253\u51FA\u89D2\u3092\u6C42\u3081\u3089\u308C\u307E\u305B\u3093"
  };
  var producerNames = { physical_pitch_progress_actions: "\u6295\u7403\u9032\u884C\u306E\u63A5\u89E6\u8A18\u9332", pa_physical_v1_resolutions: "\u6253\u5E2D\u306E\u7269\u7406\u7D50\u679C\u306E\u63A5\u89E6\u8A18\u9332", pa_initial_joint_v1_executions: "\u521D\u671F\u7D71\u5408\u7269\u7406\u8A08\u7B97\u306E\u63A5\u89E6\u8A18\u9332" };
  var reasonText = (code) => Object.hasOwn(reasons, code) ? reasons[code] : "\u8A73\u7D30\u672A\u78BA\u8A8D\uFF08" + code + "\uFF09";
  var stateText = (value) => value === "OBSERVED" ? "\u89B3\u6E2C\u6E08\u307F" : value === "UNKNOWN" ? "\u672A\u78BA\u8A8D" : value === "PARTIAL" ? "\u4E00\u90E8\u672A\u78BA\u8A8D" : value === "OBSERVED_FOR_SNAPSHOT_ROSTER" ? "\u6307\u5B9A\u30ED\u30B9\u30BF\u30FC\u3092\u78BA\u8A8D\u6E08\u307F" : "\u672A\u78BA\u8A8D\uFF08" + value + "\uFF09";
  var percent = (fraction) => {
    const n = fraction * 100, rounded = Number(n.toFixed(1));
    return (rounded === n ? "" : "\u7D04") + String(rounded) + "%";
  };
  function attachNativeContactRosterPanelV269(parent) {
    const doc = parent.ownerDocument, section = doc.createElement("section"), heading = doc.createElement("h4"), note = doc.createElement("p"), loadButton = doc.createElement("button"), clearButton = doc.createElement("button"), file = doc.createElement("input"), status = doc.createElement("p"), results = doc.createElement("div");
    section.id = "native-contact-roster-panel-v269";
    heading.textContent = "\u5916\u90E8\u306E\u6253\u7403\u8A18\u9332";
    note.textContent = "\u5916\u90E8 JSON \u306E\u5185\u5BB9\u3067\u3059\u3002Native \u7531\u6765\u3084\u771F\u6B63\u6027\u306F\u78BA\u8A8D\u3067\u304D\u307E\u305B\u3093\u3002\u73FE\u5728\u306E\u8A66\u5408\u3068\u5225\u306B\u8868\u793A\u3057\u307E\u3059\u3002";
    loadButton.type = "button";
    loadButton.textContent = "\u5916\u90E8\u8A18\u9332\u3092\u8AAD\u3080";
    clearButton.type = "button";
    clearButton.textContent = "\u5916\u90E8\u8A18\u9332\u306E\u8868\u793A\u3092\u6D88\u3059";
    file.type = "file";
    file.accept = ".json,application/json";
    file.hidden = true;
    status.setAttribute("role", "status");
    section.append(heading, note, loadButton, clearButton, file, status, results);
    parent.append(section);
    let revision = 0;
    const prepare = (text) => {
      const v = prepareNativeContactRosterViewV268(text), fragment = doc.createDocumentFragment();
      const line = (value) => {
        const p = doc.createElement("p");
        p.textContent = value;
        fragment.append(p);
      };
      line("\u5916\u90E8 JSON \uFF0F Native \u7531\u6765\u30FB\u771F\u6B63\u6027\u306F\u672A\u78BA\u8A8D");
      line("\u30AD\u30E3\u30EA\u30A2 " + v.careerId + " \uFF0F \u30ED\u30B9\u30BF\u30FC " + v.rosterSnapshotId + " \uFF0F \u5BFE\u8C61: \u6307\u5B9A\u30ED\u30B9\u30BF\u30FC\u306E\u307F \uFF0F \u5BFE\u5FDC Native \u8A18\u9332\u306E\u307F");
      line("\u30ED\u30B9\u30BF\u30FC\u306F\u6307\u5B9A\u6642\u70B9\u3001\u4EBA\u7269\u30EA\u30F3\u30AF\u3068\u6700\u7D42\u767B\u9332\u63A5\u89E6\u306F\u8AAD\u307F\u53D6\u308A\u6642\u70B9\u306E\u60C5\u5831\u3067\u3059\u3002");
      if (v.roster) line("\u30ED\u30B9\u30BF\u30FC\u306E\u65E5 " + v.roster.effectiveDay + " \uFF0F \u7248 " + v.roster.revision + " \uFF0F \u4EBA\u6570 " + v.roster.playerCount);
      if (v.reasons.length) line("\u72B6\u614B " + stateText(v.status) + " \uFF0F \u7406\u7531 " + v.reasons.map(reasonText).join("\u3001"));
      if (v.rows !== null && v.rows.length === 0) line("\u6307\u5B9A\u30ED\u30B9\u30BF\u30FC\u306B\u9078\u624B\u304C\u3044\u307E\u305B\u3093\u3002");
      for (const row of v.rows ?? []) {
        line("\u9078\u624B " + row.playerId + " \uFF0F \u540D\u524D \u672A\u78BA\u8A8D \uFF0F \u72B6\u614B " + stateText(row.status) + (row.reasons.length ? " \uFF0F \u7406\u7531 " + row.reasons.map(reasonText).join("\u3001") : ""));
        if (row.identity) line("\u4EBA\u7269 ID " + row.identity.personId + " \uFF0F \u30EA\u30F3\u30AF\u5143 " + row.identity.sourceId);
        else line("\u4EBA\u7269\u30EA\u30F3\u30AF \u672A\u78BA\u8A8D");
        if (row.producerAvailability) for (const [name, value] of Object.entries(row.producerAvailability)) line("\u8A18\u9332\u5143 " + (Object.hasOwn(producerNames, name) ? producerNames[name] : "\u7A2E\u985E\u672A\u78BA\u8A8D\uFF08" + name + "\uFF09") + " \uFF0F " + (value === "PRESENT" ? "\u8A18\u9332\u5143\u3042\u308A\uFF08\u4EF6\u6570\u306F\u5225\uFF09" : value === "ABSENT" ? "\u8A18\u9332\u5143\u306A\u3057\uFF08\u672A\u53CE\u9332\uFF09" : "\u72B6\u614B\u672A\u78BA\u8A8D\uFF08" + value + "\uFF09"));
        else line("\u8A18\u9332\u5143 \u672A\u78BA\u8A8D");
        if (row.source) line("\u6700\u7D42\u767B\u9332\u63A5\u89E6 \u901A\u7B97 " + row.source.time.day + "\u65E5 \uFF0F \u9806\u5E8F " + row.source.time.sequence);
        if (row.totalContacts === null) line("\u6253\u7403\u6570\u30FB\u53C2\u8003\u5E2F\u30FB\u5272\u5408 \u672A\u78BA\u8A8D");
        else line("\u6253\u7403 " + row.totalContacts + "\u4EF6 \uFF0F \u30E9\u30A4\u30F3\u30C9\u30E9\u30A4\u30D6\u53C2\u8003\u5E2F " + row.bandCount + "\u4EF6 \uFF0F 25\xB0\u5883\u754C " + row.boundary25Count + "\u4EF6 \uFF0F \u5272\u5408 " + (row.fraction === null ? "\u672A\u78BA\u8A8D" : percent(row.fraction)));
        for (const contact of row.contacts ?? []) {
          const label = contact.label === "BOUNDARY_25" ? "\u30E9\u30A4\u30F3\u30C9\u30E9\u30A4\u30D6\uFF0F\u30D5\u30E9\u30A4\u5883\u754C" : contact.label === "LINE_DRIVE_BAND" ? "\u30E9\u30A4\u30F3\u30C9\u30E9\u30A4\u30D6\u53C2\u8003\u5E2F" : "\u53C2\u8003\u5E2F\u5916";
          line("\u6253\u51FA\u89D2 " + (Object.is(contact.launchAngleDeg, -0) ? "-0" : String(contact.launchAngleDeg)) + "\xB0 \uFF0F " + label);
        }
      }
      line("\u6253\u51FA\u89D210\u301C25\xB0\u306F MLB \u306E\u4E00\u822C\u7684\u306A\u53C2\u8003\u5E2F\u3067\u300125\xB0\u306F\u5883\u754C\u3067\u3059\u3002\u9078\u624B\u80FD\u529B\u3084\u56DE\u8EE2\u7269\u7406\u306E\u8A8D\u5B9A\u3067\u306F\u3042\u308A\u307E\u305B\u3093\u3002");
      return fragment;
    };
    async function load(read) {
      const ticket = ++revision;
      try {
        const text = await read();
        if (ticket !== revision) return;
        const candidate = prepare(text);
        if (ticket !== revision) return;
        results.replaceChildren(candidate);
        status.textContent = "\u5916\u90E8\u8A18\u9332\u3092\u8868\u793A\u4E2D\uFF08\u771F\u6B63\u6027 \u672A\u78BA\u8A8D\uFF09";
      } catch {
        if (ticket === revision) status.textContent = "\u5916\u90E8\u8A18\u9332\u3092\u8AAD\u307F\u8FBC\u3081\u307E\u305B\u3093\u3002\u73FE\u5728\u306E\u8868\u793A\u306F\u4FDD\u6301\u3057\u307E\u3057\u305F\u3002";
      }
    }
    function clear() {
      revision++;
      results.replaceChildren();
      status.textContent = "\u5916\u90E8\u8A18\u9332\u306E\u8868\u793A\u3092\u6D88\u3057\u307E\u3057\u305F\u3002";
    }
    loadButton.onclick = () => file.click();
    clearButton.onclick = clear;
    file.onchange = () => {
      const selected = file.files?.[0];
      if (!selected) return;
      file.value = "";
      void load(async () => {
        if (selected.size > 1e7) throw Error("file too large");
        return selected.text();
      });
    };
    return Object.freeze({ section, load, clear });
  }

  // work/line-drive-ui-v269-01/watcher.mjs
  function startPanelWatcher({ document: document2, MutationObserver: MutationObserver2, attach }) {
    let observedTarget = null, panel = null, state = "WAITING_FOR_TARGET", stopped = false;
    const select = () => document2.querySelector("#local-contact-session-v240") || document2.querySelector("#normal-match-contact-v252");
    function update() {
      if (stopped) return;
      const target = select();
      if (panel && (!target || target !== observedTarget || !panel.section.isConnected)) {
        panel.section.remove();
        panel = null;
        observedTarget = null;
      }
      if (!target) {
        state = "WAITING_FOR_TARGET";
        return;
      }
      if (!panel) {
        const parent = target.parentElement;
        if (!parent) {
          state = "WAITING_FOR_TARGET";
          return;
        }
        panel = attach(parent);
        target.after(panel.section);
        observedTarget = target;
      }
      state = "ATTACHED";
    }
    const observer = new MutationObserver2(update);
    observer.observe(document2.body, { childList: true, subtree: true });
    update();
    return Object.freeze({ getStatus: () => state, stop: () => {
      if (stopped) return;
      stopped = true;
      observer.disconnect();
      state = "STOPPED";
    } });
  }

  // work/line-drive-ui-v269-01/entry.mjs
  var watcher = startPanelWatcher({ document, MutationObserver, attach: attachNativeContactRosterPanelV269 });
  window.addEventListener("pagehide", () => watcher.stop(), { once: true });
  return __toCommonJS(entry_exports);
})();

