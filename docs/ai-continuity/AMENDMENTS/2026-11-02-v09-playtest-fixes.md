# V0.9 playtest: owner's fix list (2026-11-02)

Owner played V0.9 and listed these. Each row keeps the owner's meaning. Status lives in the
release notes of the version that closes it.

## Batting and abilities

- B1. Chinsuke and Rotso barely hit now, though they hit a lot before. Explain why.
- B2. Swing speed follows power by default. A player whose swing does not follow power is the
  explicit exception, not the rule. Nobody should need the maker to set it by hand.
- B3. Owner authored abilities against the batting level before the realism work. Realism must
  not force inflation (Meet S to SSS). Keep the meaning of a rating stable and move the
  conversion, never the player data.
- B4. The owner's player and bat data becomes the default roster. (Private file, not in git.)
- B5. Robin tops out at 180 km/h, and every other pitch scales with it. Robin's ball is not
  visible and must be.

## Match logic

- M1. The plate summary ("1 at-bat 1 hit") must not appear before the play result is shown.
- M2. Catcher view: on a steal the view turns to the target base before the throw. Same for
  pickoffs. Catcher throws and pickoffs need sound.
- M3. Runners take leads scaled by their ability and the pitcher's. The green aggressive-running
  trait takes a bigger lead. Check the design on GitHub.
- M4. Catcher's throw on a steal starts too soon. It reads as a machine.
- M5. Steal results appear as a caption at the top, worded like Sportsnavi's pitch-by-pitch.
- M6. Outfielders sometimes never throw: bug. Fielders must attempt close plays. Knowing a throw
  is too late and holding the ball is a skill, not the default.
- M7. Errors are hard to read: a small "!" balloon above the player's face, in the same pixel
  density as the sprites.

## Manager mode

- K1. The match stops the moment cards appear. Tap or click plays a short card-specific
  animation (center card: the arc flies to center), then play resumes.
- K2. A card holds for one plate appearance. It may be stopped and changed, at most 3 times per
  game. A stop before the first pitch of that plate appearance costs nothing.
- K3. Fix anything else that hurts the manager's control of the match.

## Camera, view and information

- C1. The transition between pitcher, fielding and overhead views is hard to follow.
- C2. In catcher view the overhead view must start within 0.3 to 0.5 s of contact.
- C3. The pitch location chart shows in every view, not only catcher view.
- C4. The batted-ball readout, when its tab is on, shows only when a ball is put in play.

## Visual

- V1. Large screens (PC) render at higher resolution. Phones stay as they are.
- V2. The ball camouflages against busy stadiums. Keep size and physics; make it stand out in
  drawing only. Add a stadium brightness setting.
- V3. Stadiums are too heavy. Do not draw what is not on screen. Keep lightening.
- V4. Old and new sprites are mixed. Rotso changes size during the swing. Find every size
  mismatch and every haze, catchers included.
- V5. The plate umpire stands to the right of where he belongs (his right). Fix.
- V6. Fielders stretch and squash instead of using the drawn sliding frames. Remove the stretch.
- V7. Crowd reacts to the match. It does not move yet.

## Screens

- S1. Substitutions and pregame batting order do not match the design.
- S2. Pregame Tambov photo shows a closed roof and nothing else.
- S3. Report whether every design from the design department is connected.
