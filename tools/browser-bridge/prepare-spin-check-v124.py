from pathlib import Path

text = Path('tools/browser-bridge/check-maker-spin-v123.mjs').read_text(encoding='utf-8')
text = text.replace('にーくら野球メーカー_v123_打球回転技術版.html', 'にーくら野球メーカー_v124_回転技術の試打版.html')
text = text.replace('ばせぼーるlv123_TBD_vs_LAD_打球回転技術版.html', 'ばせぼーるlv124_TBD_vs_LAD_回転技術の試打版.html')
anchor = "  assert.equal(applied.mastery.nativeAdmission,false);"
assert text.count(anchor) == 1
text = text.replace(anchor, anchor + """
  assert(await page.evaluate(()=>!!globalThis.KneekuraSpinTrialV124),'trial API exists');
  await page.locator('#spin-trial-v124').evaluate(el=>el.open=true);
  await page.locator('#spin-trial-swing-v124').check();
  const trialBaseline=await page.evaluate(()=>baseballMaker.getLiveRoster());
  await page.locator('#spin-trial-run-v124').click();
  assert.match(await page.locator('#spin-trial-status-v124').textContent(),/試打しました/);
  let trial=await page.evaluate(()=>KneekuraSpinTrialV124.inspect());
  assert.equal(trial.result.requested.intent.selectedIntent,'BACKSPIN');
  assert.equal(trial.input.measuredCatalogRefs.length,673);
  assert.equal(trial.input.batter.spinControlV123.preferredIntent,'BACKSPIN');
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),trialBaseline);
  assert.equal(await page.locator('#spin-trial-comparison-v124').isChecked(),false);
  await page.locator('#spin-trial-comparison-v124').check();
  await page.locator('#spin-attack-v123').fill('13');
  await page.locator('#spin-trial-run-v124').click();
  trial=await page.evaluate(()=>KneekuraSpinTrialV124.inspect());
  assert.equal(trial.result.requested.intent.reason,'UNMASTERED_TECHNIQUE');
  await page.locator('#spin-verified-v123').check();await page.locator('#spin-trial-run-v124').click();
  trial=await page.evaluate(()=>KneekuraSpinTrialV124.inspect());
  assert.equal(trial.result.requested.intent.motion.attackAngleDegrees,13);
  assert.deepEqual(await page.evaluate(()=>baseballMaker.getLiveRoster()),trialBaseline);
  assert.match(await page.evaluate(()=>{try{baseballMaker.assertCanSave();return '';}catch(e){return e.message;}}),/未適用/);
  await page.locator('#spin-revert-v123').click();
  assert.match(await page.locator('#spin-trial-status-v124').textContent(),/再試打/);
  await page.locator('#spin-trial-run-v124').click();
  await page.locator('#spin-trial-v124').screenshot({path:resolve(out,'trial-'+width+'.png')});
""")
old = ' physical.clipId=physical.spinControlV123.techniques[0].clip.id;'
assert text.count(old) == 1
text = text.replace(old, " physical.clipId=JSON.parse(await readFile('docs/demos/measured-bat-motions.json','utf8')).clips.find(c=>c.side===physical.spinControlV123.techniques[0].clip.bats&&c.id!==physical.spinControlV123.techniques[0].clip.id).id;")
target = Path('tools/browser-bridge/check-maker-spin-v124.mjs')
if target.exists():
    assert target.read_text(encoding='utf-8') == text
else:
    target.write_text(text, encoding='utf-8')
print(target)
